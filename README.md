# go-test2html

A clean and modern HTML report generator for Go test results. This tool converts Go's JSON test output into beautiful HTML reports with detailed test information and statistics.

## Features

- **Beautiful HTML Reports**: Generate clean, responsive, and modern HTML reports for your Go tests
- **Test Summary**: Get quick insights with total, passed, failed, and skipped test counts
- **Package Organization**: Tests are neatly organized by package with expandable sections
- **Test Details**: Easily view test output, duration, and status
- **Automatic Highlighting**: Failed tests are automatically expanded for quick debugging
- **Responsive Design**: Reports look great on desktop and mobile devices

## Installation

```
go install github.com/FloSch62/go-test2html@latest
```

Or clone and build:

```
git clone https://github.com/FloSch62/go-test2html.git
cd go-test2html
go build
```

## Usage

The tool accepts JSON test output from Go's testing package and converts it to HTML. 

Basic usage:

```
# Run tests with JSON output and pipe to the report generator
go test ./... -json | go-test2html

# Or save test output to a file and process it
go test ./... -json > test-output.json
go-test2html --input test-output.json
```

### Options

```
  -input string
        JSON input file (defaults to stdin if not specified)
  -output string
        HTML output file (default "test-report.html")
  -title string
        Report title (default "Go Test Report")
```

## Example

```
# Generate a report with a custom title
go test ./... -json | go-test2html --title "My Project Test Results" --output my-report.html
```

## How It Works

1. The tool reads JSON test events from Go's `-json` test output format
2. It processes these events to track test status, duration, and output
3. Tests are organized by package and sorted by execution time
4. The data is rendered into a beautiful HTML report using an embedded template
5. The final report is saved to the specified output file

## Report Preview

The generated HTML report includes:

- A header with the title and generation date
- Summary cards showing test counts (total, passed, failed, skipped)
- Collapsible package sections with test summaries
- Detailed test information including name, duration, and status
- Expandable test output for debugging failed tests
- Responsive design that works on all devices

## Why Use This?

- **Better Visibility**: See all your test results in an easy-to-read format
- **Easier Debugging**: Quickly identify and debug failed tests
- **Shareable Reports**: Generate reports that can be shared with team members
- **CI Integration**: Add test reporting to your CI/CD pipelines

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.