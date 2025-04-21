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
	"sort"
	"strings"
	"time"
)

//go:embed templates/report-template.html
var reportTemplateFS embed.FS

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
	Name      string
	Package   string
	Passed    bool
	Skipped   bool
	Failed    bool
	Duration  float64
	Output    []string
	Timestamp time.Time // Store the timestamp for sorting
}

// PackageResult aggregates test results by package
type PackageResult struct {
	Name    string
	Tests   map[string]*TestResult
	Summary struct {
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
	Title   string
	Date    time.Time
	Summary struct {
		Total   int
		Passed  int
		Failed  int
		Skipped int
	}
	Packages map[string]*PackageResult
}

func main() {
	inputFile := flag.String("input", "", "JSON input file (defaults to stdin if not specified)")
	outputFile := flag.String("output", "test-report.html", "HTML output file")
	title := flag.String("title", "Go Test to html", "Report title")
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
				Name:      event.Test,
				Package:   event.Package,
				Timestamp: event.ParsedTime(), // Store timestamp
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
			report.Summary.Passed++
			report.Summary.Total++
		case "fail":
			test.Duration = event.Elapsed
			test.Failed = true
			pkg.Summary.Failed++
			pkg.Summary.Total++
			report.Summary.Failed++
			report.Summary.Total++
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
	// Parse the template from the embedded file
	tmpl, err := template.ParseFS(reportTemplateFS, "templates/report-template.html")
	if err != nil {
		return "", fmt.Errorf("failed to parse template file: %v", err)
	}

	var buffer strings.Builder
	err = tmpl.Execute(&buffer, report)
	if err != nil {
		return "", err
	}

	return buffer.String(), nil
}
