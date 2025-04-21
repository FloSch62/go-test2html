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
        const testName = test.getAttribute('data-test-name').toLowerCase();
        const testStatus = test.getAttribute('data-test-status');
        const matchesStatus = state.statusFilter === 'all' || testStatus === state.statusFilter;
        const matchesSearch = !state.searchTerm || testName.includes(state.searchTerm);

        if (matchesStatus && matchesSearch) {
            test.classList.remove('hidden');
            visibleTestCount++;
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
}

// Toggle test output display
function toggleOutput(test) {
    const output = test.querySelector('.test-output');
    if (output) {
        output.classList.toggle('open');
    }
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