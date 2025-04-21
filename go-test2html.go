package main

import (
	"bufio"
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"html/template"
	"io"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"
)

//go:embed templates/report-template.html templates/report-styles.css templates/report-script.js
var templatesFS embed.FS

// TestEvent represents a single event in the Go test output
type TestEvent struct {
	Time    string  `json:"Time"`
	Action  string  `json:"Action"`
	Package string  `json:"Package"`
	Test    string  `json:"Test,omitempty"`
	Output  string  `json:"Output,omitempty"`
	Elapsed float64 `json:"Elapsed,omitempty"`
}

// ParsedTime returns the parsed time.Time from the Time field
func (e TestEvent) ParsedTime() time.Time {
	t, err := time.Parse(time.RFC3339Nano, e.Time)
	if err != nil {
		// Return current time if parsing fails
		return time.Now()
	}
	return t
}

// TestResult aggregates information about a single test
type TestResult struct {
	Name          string
	Package       string
	Passed        bool
	Skipped       bool
	Failed        bool
	Duration      float64
	Output        []string
	Timestamp     time.Time // Store the timestamp for sorting
	FormattedName string    // Store the human-readable formatted name
}

// PackageResult aggregates test results by package
type PackageResult struct {
	Name          string
	Tests         map[string]*TestResult
	TotalDuration float64 // Track total duration for the package
	Summary       struct {
		Total   int
		Passed  int
		Failed  int
		Skipped int
	}
}

// SortedTests returns tests sorted by timestamp
func (p *PackageResult) SortedTests() []*TestResult {
	tests := make([]*TestResult, 0, len(p.Tests))
	for _, test := range p.Tests {
		tests = append(tests, test)
	}

	// Sort tests by timestamp
	sort.Slice(tests, func(i, j int) bool {
		return tests[i].Timestamp.Before(tests[j].Timestamp)
	})

	return tests
}

// ReportData holds all data for the report template
type ReportData struct {
	Title         string
	Date          time.Time
	TotalDuration float64 // Track overall total duration
	Summary       struct {
		Total   int
		Passed  int
		Failed  int
		Skipped int
	}
	Packages map[string]*PackageResult
}

// formatTestName converts test names from camelCase or snake_case to readable format
// e.g., "TestLoginSuperuser" becomes "Test Login Superuser"
func formatTestName(name string) string {
	// Skip if it's not a typical test name
	if !strings.HasPrefix(name, "Test") {
		return name
	}

	// Add space before capitals
	re := regexp.MustCompile(`([a-z])([A-Z])`)
	name = re.ReplaceAllString(name, "$1 $2")

	// Replace underscores with spaces
	name = strings.ReplaceAll(name, "_", " ")

	// Ensure proper spacing after "Test" prefix
	if strings.HasPrefix(name, "Test ") {
		return name
	}
	return strings.Replace(name, "Test", "Test ", 1)
}

func main() {
	inputFile := flag.String("input", "", "JSON input file (defaults to stdin if not specified)")
	outputFile := flag.String("output", "test-report.html", "HTML output file")
	title := flag.String("title", "Go Test Report", "Report title")
	flag.Parse()

	var input io.Reader
	if *inputFile != "" {
		file, err := os.Open(*inputFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error opening input file: %v\n", err)
			os.Exit(1)
		}
		defer file.Close()
		input = file
	} else {
		input = os.Stdin
	}

	// Read and parse the JSON
	events, err := readEvents(input)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing JSON: %v\n", err)
		os.Exit(1)
	}

	// Process the events into a structured report
	report := processEvents(events, *title)

	// Create the HTML report
	html, err := generateHTML(report)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating HTML: %v\n", err)
		os.Exit(1)
	}

	// Output the HTML
	file, err := os.Create(*outputFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating output file: %v\n", err)
		os.Exit(1)
	}
	defer file.Close()

	_, err = file.Write([]byte(html))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error writing HTML output: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Test report generated at %s\n", *outputFile)
}

func readEvents(r io.Reader) ([]TestEvent, error) {
	var events []TestEvent

	// Try to read line by line as individual JSON objects
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		var event TestEvent
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			return nil, fmt.Errorf("failed to parse JSON line: %v", err)
		}

		// Skip output lines containing just "?"
		if event.Output == "?\t"+event.Package+"\t[no test files]\n" {
			continue
		}

		events = append(events, event)
	}

	if scanner.Err() != nil {
		return nil, fmt.Errorf("error scanning input: %v", scanner.Err())
	}

	return events, nil
}

func processEvents(events []TestEvent, title string) ReportData {
	packages := make(map[string]*PackageResult)
	emptyPackages := make(map[string]bool) // Track packages with no tests
	report := ReportData{
		Title:    title,
		Date:     time.Now(),
		Packages: packages,
	}

	// First pass: identify empty packages (no test files)
	for _, event := range events {
		if event.Action == "skip" && event.Elapsed == 0 && event.Test == "" {
			emptyPackages[event.Package] = true
		}
	}

	// Second pass: process actual test events, skipping empty packages
	for _, event := range events {
		// Skip events for packages with no tests
		if emptyPackages[event.Package] {
			continue
		}

		pkg, ok := packages[event.Package]
		if !ok {
			pkg = &PackageResult{
				Name:  event.Package,
				Tests: make(map[string]*TestResult),
			}
			packages[event.Package] = pkg
		}

		// Skip package-level events
		if event.Test == "" {
			continue
		}

		test, ok := pkg.Tests[event.Test]
		if !ok {
			test = &TestResult{
				Name:          event.Test,
				FormattedName: formatTestName(event.Test), // Format the test name
				Package:       event.Package,
				Timestamp:     event.ParsedTime(), // Store timestamp
			}
			pkg.Tests[event.Test] = test
		}

		switch event.Action {
		case "run":
			// Update timestamp on test start for better sorting
			test.Timestamp = event.ParsedTime()
		case "pass":
			test.Duration = event.Elapsed
			test.Passed = true
			pkg.Summary.Passed++
			pkg.Summary.Total++
			pkg.TotalDuration += event.Elapsed
			report.Summary.Passed++
			report.Summary.Total++
			report.TotalDuration += event.Elapsed
		case "fail":
			test.Duration = event.Elapsed
			test.Failed = true
			pkg.Summary.Failed++
			pkg.Summary.Total++
			pkg.TotalDuration += event.Elapsed
			report.Summary.Failed++
			report.Summary.Total++
			report.TotalDuration += event.Elapsed
		case "skip":
			test.Duration = event.Elapsed
			test.Skipped = true
			pkg.Summary.Skipped++
			pkg.Summary.Total++
			report.Summary.Skipped++
			report.Summary.Total++
		case "output":
			if event.Output != "" {
				test.Output = append(test.Output, event.Output)
			}
		}
	}

	return report
}

func generateHTML(report ReportData) (string, error) {
	// Create a template with the main template and define named templates for CSS and JS
	tmpl := template.New("report-template.html")

	// Parse all template files from the embedded filesystem
	htmlContent, err := templatesFS.ReadFile("templates/report-template.html")
	if err != nil {
		return "", fmt.Errorf("failed to read HTML template: %v", err)
	}

	cssContent, err := templatesFS.ReadFile("templates/report-styles.css")
	if err != nil {
		return "", fmt.Errorf("failed to read CSS template: %v", err)
	}

	jsContent, err := templatesFS.ReadFile("templates/report-script.js")
	if err != nil {
		return "", fmt.Errorf("failed to read JS template: %v", err)
	}

	// Parse the main template
	tmpl, err = tmpl.Parse(string(htmlContent))
	if err != nil {
		return "", fmt.Errorf("failed to parse HTML template: %v", err)
	}

	// Add the CSS as a named template
	_, err = tmpl.New("styles").Parse(string(cssContent))
	if err != nil {
		return "", fmt.Errorf("failed to parse CSS template: %v", err)
	}

	// Add the JS as a named template
	_, err = tmpl.New("scripts").Parse(string(jsContent))
	if err != nil {
		return "", fmt.Errorf("failed to parse JS template: %v", err)
	}

	// Execute the template with the report data
	var buffer strings.Builder
	err = tmpl.Execute(&buffer, report)
	if err != nil {
		return "", fmt.Errorf("failed to execute template: %v", err)
	}

	return buffer.String(), nil
}
