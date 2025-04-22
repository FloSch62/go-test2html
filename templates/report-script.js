// State management
const state = {
    statusFilter: 'all', // 'all', 'passed', 'failed', 'skipped'
    searchTerm: '',
    updateFilters: function() {
        applyFilters();
        updateFilterStatus();
    }
};

// DOM Elements
const searchField = document.getElementById('searchField');
const filterStatus = document.getElementById('filterStatus');
const noResults = document.getElementById('noResults');
const summaryCards = document.querySelectorAll('.summary-card[data-filter]');
const packages = document.querySelectorAll('.package');
const allTests = document.querySelectorAll('.test-item');

// Event Listeners
searchField.addEventListener('input', function() {
    state.searchTerm = this.value.toLowerCase().trim();
    state.updateFilters();
});

summaryCards.forEach(card => {
    card.addEventListener('click', function() {
        const filter = this.getAttribute('data-filter');

        // Toggle filter if it's already active
        if (state.statusFilter === filter) {
            state.statusFilter = 'all';
        } else {
            state.statusFilter = filter;
        }

        updateActiveFilterCard();
        state.updateFilters();
    });
});

// Initialize with "all" filter active
function initializeFilters() {
    updateActiveFilterCard();
    state.updateFilters();

    // Automatically open packages with failures
    const packagesWithFailures = Array.from(packages)
        .filter(pkg => pkg.querySelector('.summary-item.failed'));

    packagesWithFailures.forEach(pkg => {
        const header = pkg.querySelector('.package-header');
        const content = pkg.querySelector('.package-content');
        header.classList.add('open');
        content.classList.add('open');

        // Auto-expand failed tests
        const failedTests = pkg.querySelectorAll('.test-item[data-test-status="failed"]');
        failedTests.forEach(test => {
            // Only expand top-level failed tests
            if (!test.closest('.subtest-list')) {
                test.classList.add('open');

                // Show output
                const output = test.querySelector('.test-output');
                if (output) output.classList.add('open');

                // Show subtests container if it exists
                const subtestContainer = test.querySelector('.subtest-container');
                if (subtestContainer) subtestContainer.classList.add('open');
            }
        });
    });
}

// Update active filter card visual state
function updateActiveFilterCard() {
    summaryCards.forEach(card => {
        const cardFilter = card.getAttribute('data-filter');
        if (cardFilter === state.statusFilter) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
}

// Update filter status text
function updateFilterStatus() {
    let statusHTML = '';

    if (state.statusFilter !== 'all') {
        const statusText = state.statusFilter.charAt(0).toUpperCase() + state.statusFilter.slice(1);
        statusHTML += `Showing <span class="filter-tag ${state.statusFilter}">${statusText} tests</span>`;
    }

    if (state.searchTerm) {
        if (statusHTML) statusHTML += ' and ';
        statusHTML += `Search: <span class="filter-tag search">${state.searchTerm}</span>`;
    }

    if (statusHTML) {
        statusHTML += '<button class="clear-filters" onclick="clearFilters()">Clear all</button>';
    }

    filterStatus.innerHTML = statusHTML;
}

// Clear all filters
function clearFilters() {
    state.statusFilter = 'all';
    state.searchTerm = '';
    searchField.value = '';
    updateActiveFilterCard();
    state.updateFilters();
}

// Apply filters to test items
function applyFilters() {
    let visibleTestCount = 0;
    let visiblePackages = new Set();

    // First hide all tests according to filters
    allTests.forEach(test => {
        // Skip subtests in initial filter
        if (test.closest('.subtest-list')) return;

        const testName = test.getAttribute('data-test-name').toLowerCase();
        const testStatus = test.getAttribute('data-test-status');
        const matchesStatus = state.statusFilter === 'all' || testStatus === state.statusFilter;
        const matchesSearch = !state.searchTerm || testName.includes(state.searchTerm);

        // Main test visibility
        let testVisible = matchesStatus && matchesSearch;

        // Check subtests for matches as well
        if (!testVisible && state.searchTerm) {
            const subtests = test.querySelectorAll('.subtest-item');
            for (const subtest of subtests) {
                const subtestName = subtest.getAttribute('data-test-name').toLowerCase();
                if (subtestName.includes(state.searchTerm)) {
                    testVisible = true;
                    break;
                }
            }
        }

        if (testVisible) {
            test.classList.remove('hidden');
            visibleTestCount++;

            // If searching, auto-expand tests with matching subtests
            if (state.searchTerm) {
                const subtestContainer = test.querySelector('.subtest-container');
                if (subtestContainer) {
                    subtestContainer.classList.add('open');
                    test.classList.add('open');

                    // Show individual subtests that match search
                    const subtests = test.querySelectorAll('.subtest-item');
                    subtests.forEach(subtest => {
                        const subtestName = subtest.getAttribute('data-test-name').toLowerCase();
                        if (subtestName.includes(state.searchTerm)) {
                            subtest.classList.remove('hidden');
                        } else {
                            subtest.classList.add('hidden');
                        }
                    });
                }
            }

            // Track which package has visible tests
            const packageElement = test.closest('.package');
            visiblePackages.add(packageElement);
        } else {
            test.classList.add('hidden');
        }
    });

    // Then hide packages with no visible tests
    packages.forEach(pkg => {
        if (visiblePackages.has(pkg)) {
            pkg.classList.remove('hidden');
        } else {
            pkg.classList.add('hidden');
        }
    });

    // Show "no results" message if needed
    if (visibleTestCount === 0) {
        noResults.style.display = 'block';
    } else {
        noResults.style.display = 'none';
    }
}

// Toggle package expansion
function togglePackage(header) {
    header.classList.toggle('open');
    const content = header.nextElementSibling;
    content.classList.toggle('open');
    const icon = header.querySelector('.toggle-icon');
    if (icon) {
        if (header.classList.contains('open')) {
            icon.style.transform = 'rotate(90deg)';
        } else {
            icon.style.transform = 'rotate(0deg)';
        }
    }
}

// Toggle test expansion (for parent tests with subtests)
function toggleTest(test) {
    test.classList.toggle('open');

    // Toggle the output display
    const output = test.querySelector('.test-output');
    if (output) {
        output.classList.toggle('open');
    }

    // Toggle subtest container if it exists
    const subtestContainer = test.querySelector('.subtest-container');
    if (subtestContainer) {
        subtestContainer.classList.toggle('open');
    }

    // Toggle icon rotation
    const icon = test.querySelector('.toggle-icon');
    if (icon) {
        if (test.classList.contains('open')) {
            icon.style.transform = 'rotate(90deg)';
        } else {
            icon.style.transform = 'rotate(0deg)';
        }
    }
}

// Toggle test output display (for tests without subtests)
function toggleOutput(test) {
    const output = test.querySelector('.test-output');
    if (output) {
        output.classList.toggle('open');
    }
}

// Debug mode functionality
function toggleDebug() {
    const checkbox = document.getElementById('debug-checkbox');
    if (checkbox.checked) {
        document.body.classList.add('show-debug');
        localStorage.setItem('debug', 'show');
    } else {
        document.body.classList.remove('show-debug');
        localStorage.setItem('debug', 'hide');
    }
}

// Process debug lines in all test outputs
function processDebugLines() {
    const outputContainers = document.querySelectorAll('.test-output');
    
    outputContainers.forEach(container => {
        const content = container.innerHTML;
        
        // Process the output content
        let processedContent = '';
        let inDebugBlock = false;
        let currentDebugBlock = '';
        
        // Split content by line breaks
        const lines = content.split(/\n|<br>/);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if this is a debug line
            if (line.includes('🔍 DEBUG:') || line.includes('DEBUG:')) {
                // If we're not already in a debug block, start one
                if (!inDebugBlock) {
                    inDebugBlock = true;
                    currentDebugBlock = '<div class="debug-content">';
                }
                
                // Add this line to current debug block
                currentDebugBlock += line + '\n';
                
                // Look ahead to include related content (JSON, etc.)
                let j = i + 1;
                while (j < lines.length) {
                    const nextLine = lines[j];
                    
                    // If we encounter another debug line, break
                    if (nextLine.includes('🔍 DEBUG:') || nextLine.includes('DEBUG:')) {
                        break;
                    }
                    
                    // Include indented lines, JSON markers, brackets in the debug block
                    if (nextLine.trim().startsWith(' ') || 
                        nextLine.includes('---') || 
                        nextLine.includes('{') || 
                        nextLine.includes('}') ||
                        nextLine.trim() === '') {
                        
                        currentDebugBlock += nextLine + '\n';
                        i++; // Skip this line in the main loop
                        j++;
                    } else {
                        break;
                    }
                }
                
                // Close the debug block
                currentDebugBlock += '</div>';
                processedContent += currentDebugBlock;
                inDebugBlock = false;
                currentDebugBlock = '';
            } else {
                // Non-debug line, add as-is
                processedContent += line + '\n';
            }
        }
        
        // Update the container content
        container.innerHTML = processedContent;
    });
}

// Initialize debug mode settings
function initDebug() {
    // Process debug lines in test output
    processDebugLines();
    
    // Check for saved preference
    const savedDebug = localStorage.getItem('debug');
    const debugCheckbox = document.getElementById('debug-checkbox');
    
    if (savedDebug === 'show') {
        document.body.classList.add('show-debug');
        debugCheckbox.checked = true;
    }
    
    // Add event listener for toggle
    debugCheckbox.addEventListener('change', toggleDebug);
}

// Dark mode theme functionality
function initTheme() {
    // Check for saved theme preference or use system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Set the initial theme
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (savedTheme === 'dark') {
            document.getElementById('checkbox').checked = true;
        }
    } else if (systemPrefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('checkbox').checked = true;
    }
}

// Toggle theme when switch is clicked
function toggleTheme() {
    const checkbox = document.getElementById('checkbox');
    if (checkbox.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }
}

// Add event listeners and initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeFilters();

    // Initialize theme
    initTheme();
    
    // Initialize debug toggle
    initDebug();

    // Add event listener for theme toggle
    const themeToggle = document.getElementById('checkbox');
    if (themeToggle) {
        themeToggle.addEventListener('change', toggleTheme);
    }

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (mediaQuery) {
        mediaQuery.addEventListener('change', e => {
            // Only update if user hasn't set a preference
            if (!localStorage.getItem('theme')) {
                if (e.matches) {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    document.getElementById('checkbox').checked = true;
                } else {
                    document.documentElement.setAttribute('data-theme', 'light');
                    document.getElementById('checkbox').checked = false;
                }
            }
        });
    }
});