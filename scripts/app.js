// App state (in-memory only)
let stories = [];
let dataMetadata = {}; // Store metadata like last_run
let currentIndex = 0;
const STORIES_PER_LOAD = 25;
const DATA_URL = 'https://lewdry.github.io/ramah-data/good_news.json';

// Track if stats have been calculated (lazy calculation)
let statsCalculated = false;

// Track if more stories are being loaded (debounce infinite scroll)
let isLoadingMore = false;

// Intersection Observer for infinite scroll
let scrollObserver = null;

// Initialization
async function init() {
  loadThemePreference();
  setupThemeToggle();
  setupRouter();
  
  // Handle initial route
  await handleRoute();
}

// Router
function setupRouter() {
  window.addEventListener('hashchange', handleRoute);
}

async function handleRoute() {
  const hash = window.location.hash;
  
  if (hash === '#stats') {
    await showStatsPage();
  } else if (hash === '#embed') {
    await showEmbedPage();
  } else if (hash === '#get-data') {
    await showGetDataPage();
  } else {
    await showHomePage();
  }
}

async function showHomePage() {
  // Close all modals if open
  closeStatsModal();
  closeEmbedModal();
  closeGetDataModal();
  showElement('page-home');
  hideElement('error-state');
  
  // Only fetch and render if not already done
  if (stories.length === 0) {
    await fetchStories();

    if (stories.length > 0) {
      hideElement('loading-indicator');
      renderStories(STORIES_PER_LOAD);
      setupInfiniteScroll();
    } else {
      showErrorState();
    }
  } else {
    hideElement('loading-indicator');
  }
}

async function showStatsPage() {
  // Ensure homepage is shown but hidden behind modal
  showElement('page-home');
  
  // Open stats modal
  const modal = document.getElementById('stats-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  showElement('stats-loading');
  hideElement('stats-content');

  // Only calculate stats when opening the modal (lazy calculation)
  if (!statsCalculated) {
    // Ensure we have data
    if (stories.length === 0) {
      await fetchStories();
    }

    if (stories.length > 0) {
      calculateAndDisplayStats();
      statsCalculated = true;
    }
  }

  hideElement('stats-loading');
  showElement('stats-content');

  // Move focus into modal for accessibility
  const closeBtn = document.getElementById('stats-modal-close');
  if (closeBtn) closeBtn.focus();
}

async function showEmbedPage() {
  // Ensure homepage is shown but hidden behind modal
  showElement('page-home');
  
  // Open embed modal
  const modal = document.getElementById('embed-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateEmbedCode();
    updatePreview();
  }

  // Move focus into modal for accessibility
  const closeBtn = document.getElementById('embed-modal-close');
  if (closeBtn) closeBtn.focus();
}

async function showGetDataPage() {
  // Ensure homepage is shown but hidden behind modal
  showElement('page-home');
  
  // Open get-data modal
  const modal = document.getElementById('get-data-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  // Move focus into modal for accessibility
  const closeBtn = document.getElementById('get-data-modal-close');
  if (closeBtn) closeBtn.focus();
}

function calculateAndDisplayStats() {
  // Last Updated - use last run metadata, fall back to most recent story
  let lastUpdatedText = 'Unknown';
  if (dataMetadata['last run']) {
    try {
      lastUpdatedText = formatRelativeTime(dataMetadata['last run']);
    } catch (error) {
      console.error('Error formatting last updated date:', error);
      // Fall back to most recent story
      if (stories.length > 0) {
        lastUpdatedText = formatRelativeTime(stories[0].timestamp);
      }
    }
  } else if (stories.length > 0) {
    // No last run metadata, use most recent story timestamp
    try {
      lastUpdatedText = formatRelativeTime(stories[0].timestamp);
    } catch (error) {
      console.error('Error formatting story timestamp:', error);
      lastUpdatedText = 'Unknown';
    }
  }
  document.getElementById('stat-last-updated').textContent = lastUpdatedText;
  
  // Article count
  const articleCount = stories.length;
  document.getElementById('stat-article-count').textContent = articleCount.toLocaleString();
  
  // Sources count (sorted by count, largest first)
  const sourceCounts = {};
  stories.forEach(story => {
    const source = story.source || 'Unknown';
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  });
  
  const sortedSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1]);
  
  const sourcesList = document.getElementById('stat-sources-list');
  sourcesList.innerHTML = sortedSources.map(([source, count]) => `
    <li class="flex justify-between items-center py-2 border-b border-base-01 last:border-0">
      <span class="font-medium">${escapeHtml(source)}</span>
      <span class="text-base-03">${count.toLocaleString()}</span>
    </li>
  `).join('');
  
  // Oldest article date
  if (stories.length > 0) {
    const oldestStory = stories.reduce((oldest, story) => {
      const storyDate = new Date(story.timestamp);
      const oldestDate = new Date(oldest.timestamp);
      return storyDate < oldestDate ? story : oldest;
    }, stories[0]);
    
    const oldestDate = new Date(oldestStory.timestamp);
    const formattedDate = oldestDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    document.getElementById('stat-oldest-date').textContent = formattedDate;
  } else {
    document.getElementById('stat-oldest-date').textContent = 'No articles';
  }
}

// Theme Management
function loadThemePreference() {
  // Check for URL parameter first (for embedded views)
  const urlParams = new URLSearchParams(window.location.search);
  const themeParam = urlParams.get('theme');
  
  let savedTheme;
  
  if (themeParam === 'light' || themeParam === 'dark') {
    // URL parameter takes precedence - don't use localStorage
    savedTheme = themeParam;
  } else {
    // Fall back to localStorage or system preference
    savedTheme = localStorage.getItem('ramah-theme');
    
    if (!savedTheme) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      savedTheme = prefersDark ? 'dark' : 'light';
    }
  }
  
  document.documentElement.setAttribute('data-theme', savedTheme);
  const toggle = document.getElementById('theme-toggle-input');
  toggle.checked = savedTheme === 'dark';
  
  // Update aria-checked for accessibility
  const track = toggle.nextElementSibling;
  if (track) track.setAttribute('aria-checked', savedTheme === 'dark');
}

function setupThemeToggle() {
  const toggle = document.getElementById('theme-toggle-input');
  toggle.addEventListener('change', () => {
    const newTheme = toggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('ramah-theme', newTheme);
    
    // Update aria-checked
    const track = toggle.nextElementSibling;
    if (track) track.setAttribute('aria-checked', toggle.checked);
  });
}

// Fetch & parse JSON
async function fetchStories() {
  try {
    showElement('loading-indicator');
    const response = await fetch(DATA_URL);

    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    
    // Handle multiple possible formats
    let articlesArray = [];
    dataMetadata = {};
    
    if (Array.isArray(data)) {
      // Format 1: Direct array of stories
      articlesArray = data;
    } else if (data.stories && Array.isArray(data.stories)) {
      // Format 2: Object with "stories" array (current format)
      articlesArray = data.stories;
      // Store metadata (last run, etc.)
      dataMetadata = { ...data };
      delete dataMetadata.stories; // Remove stories from metadata
    } else if (data.articles && Array.isArray(data.articles)) {
      // Format 3: Object with "articles" array (alternative)
      articlesArray = data.articles;
      dataMetadata = { ...data };
      delete dataMetadata.articles;
    } else {
      throw new Error('Invalid data format: expected array or object with "stories" or "articles" property');
    }

    // Validate we have articles
    if (articlesArray.length === 0) {
      console.warn('No articles found in the data');
    }

    // Sort by timestamp descending (most recent first)
    stories = articlesArray.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateB - dateA;
    });

    hideElement('loading-indicator');
  } catch (error) {
    console.error('Failed to fetch stories:', error);
    hideElement('loading-indicator');
    stories = [];
    dataMetadata = {};
  }
}

// Render stories to DOM
function renderStories(count) {
  const feed = document.getElementById('story-feed');
  const fragment = document.createDocumentFragment();
  const endIndex = Math.min(currentIndex + count, stories.length);

  for (let i = currentIndex; i < endIndex; i++) {
    const card = createStoryCard(stories[i]);
    fragment.appendChild(card);
  }

  feed.appendChild(fragment);
  currentIndex = endIndex;

  if (currentIndex >= stories.length) {
    showElement('end-message');
  }
}

// Create individual story card
function createStoryCard(story) {
  const card = document.createElement('article');
  card.className = 'story-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `Story: ${story.headline}`);

  const indicator = getPositivityIndicator(story.mean_score);
  const relativeTime = formatRelativeTime(story.timestamp);

  card.innerHTML = `
    <h2 class="story-title text-xl lg:text-2xl font-medium mb-3">${escapeHtml(story.headline)}</h2>
    <p class="story-preview text-base lg:text-lg mb-3 font-body">${escapeHtml(story.first_sentence)}</p>
    <div class="text-sm text-base-03 flex items-center gap-2">
      ${indicator ? `<span class="text-success tracking-wide">${indicator}</span>` : ''}
      ${indicator ? `<span class="opacity-50">•</span>` : ''}
      <span class="font-medium">${escapeHtml(story.source)}</span>
      <span class="opacity-50">•</span>
      <span>${relativeTime}</span>
    </div>
  `;

  const openStory = () => {
    window.open(story.link, '_blank', 'noopener,noreferrer');
  };

  card.addEventListener('click', openStory);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openStory();
    }
  });

  return card;
}

// Positivity indicator mapping
function getPositivityIndicator(score) {
  if (score >= 0.7) return '△△△';
  if (score >= 0.4) return '△△';
  if (score >= 0.2) return '△';
  return '';
}

// Format timestamp to human-readable relative time
function formatRelativeTime(timestamp) {
  try {
    if (!timestamp) {
      return 'Unknown date';
    }
    
    const now = new Date();
    const date = new Date(timestamp);
    
    // Check for invalid date
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', timestamp);
      return 'Unknown date';
    }
    
    const diffMs = now - date;
    
    // Handle future dates
    if (diffMs < 0) {
      return 'Just now';
    }
    
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } else if (diffWeeks < 4) {
      return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
    } else {
      return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
    }
  } catch (error) {
    console.error('Error formatting relative time:', error, 'Timestamp:', timestamp);
    return 'Unknown date';
  }
}

// Infinite scroll handler using Intersection Observer
function setupInfiniteScroll() {
  // Clean up existing observer if any
  if (scrollObserver) {
    scrollObserver.disconnect();
  }
  
  // Create a sentinel element to observe
  let sentinel = document.getElementById('scroll-sentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.style.height = '1px';
    sentinel.setAttribute('aria-hidden', 'true');
    const feed = document.getElementById('story-feed');
    feed.parentNode.insertBefore(sentinel, feed.nextSibling);
  }
  
  // Create Intersection Observer
  scrollObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    
    // Check if sentinel is visible and we have more stories to load
    if (entry.isIntersecting && currentIndex < stories.length && !isLoadingMore) {
      isLoadingMore = true;
      showElement('loading-indicator');
      
      // Small delay for visual feedback
      setTimeout(() => {
        renderStories(STORIES_PER_LOAD);
        hideElement('loading-indicator');
        isLoadingMore = false;
        
        // If we've loaded all stories, disconnect the observer
        if (currentIndex >= stories.length) {
          scrollObserver.disconnect();
        }
      }, 150);
    }
  }, {
    root: null, // viewport
    rootMargin: '200px', // trigger 200px before sentinel enters viewport
    threshold: 0
  });
  
  // Start observing
  scrollObserver.observe(sentinel);
}

// Error state
function showErrorState() {
  showElement('error-state');
  hideElement('story-feed');
  hideElement('loading-indicator');

  const retryBtn = document.getElementById('retry-button');
  
  // Remove existing listeners to prevent duplicates
  const newRetryBtn = retryBtn.cloneNode(true);
  retryBtn.parentNode.replaceChild(newRetryBtn, retryBtn);
  
  newRetryBtn.addEventListener('click', async () => {
    hideElement('error-state');
    showElement('story-feed');
    currentIndex = 0;
    document.getElementById('story-feed').innerHTML = '';
    hideElement('end-message');
    
    await fetchStories();

    if (stories.length > 0) {
      renderStories(STORIES_PER_LOAD);
      setupInfiniteScroll();
    } else {
      showErrorState();
    }
  });
}

// Utility: show/hide elements
function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// Utility: escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Embed Modal
const EMBED_BASE_URL = 'https://lewdry.github.io/ramah';

function setupEmbedModal() {
  const modal = document.getElementById('embed-modal');
  const openBtn = document.getElementById('embed-btn');
  const closeBtn = document.getElementById('embed-modal-close');
  const copyBtn = document.getElementById('embed-copy-btn');
  
  // Input elements
  const widthInput = document.getElementById('embed-width');
  const widthUnit = document.getElementById('embed-width-unit');
  const heightInput = document.getElementById('embed-height');
  const heightUnit = document.getElementById('embed-height-unit');
  const themeSelect = document.getElementById('embed-theme');
  const borderEnabledCheckbox = document.getElementById('embed-border-enabled');
  
  // Open modal
  openBtn.addEventListener('click', () => {
    window.location.hash = '#embed';
  });
  
  // Close modal
  const closeModal = () => {
    window.location.hash = '#';
  };
  
  closeBtn.addEventListener('click', closeModal);
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
  
  // Handle border checkbox toggle
  borderEnabledCheckbox.addEventListener('change', () => {
    updateEmbedCode();
    updatePreview();
  });
  
  // Update embed code on input change
  const updateOnChange = () => {
    updateEmbedCode();
    updatePreview();
  };
  
  widthInput.addEventListener('input', updateOnChange);
  widthUnit.addEventListener('change', updateOnChange);
  heightInput.addEventListener('input', updateOnChange);
  heightUnit.addEventListener('change', updateOnChange);
  themeSelect.addEventListener('change', updateOnChange);
  
  // Copy button
  copyBtn.addEventListener('click', copyEmbedCode);
}

// Stats Modal helpers
function closeStatsModal() {
  const modal = document.getElementById('stats-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';

  // Remove #stats hash without creating a new history entry
  if (window.location.hash === '#stats') {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function closeEmbedModal() {
  const modal = document.getElementById('embed-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';

  // Remove #embed hash without creating a new history entry
  if (window.location.hash === '#embed') {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function closeGetDataModal() {
  const modal = document.getElementById('get-data-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';

  // Remove #get-data hash without creating a new history entry
  if (window.location.hash === '#get-data') {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function setupStatsModal() {
  const modal = document.getElementById('stats-modal');
  if (!modal) return;

  const closeBtn = document.getElementById('stats-modal-close');

  const closeModal = () => {
    window.location.hash = '#';
  };

  closeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });
}



function getEmbedUrl() {
  const themeSelect = document.getElementById('embed-theme');
  const theme = themeSelect.value;
  
  let url = EMBED_BASE_URL;
  
  // Add theme parameter if not auto
  if (theme !== 'auto') {
    url += `?theme=${theme}`;
  }
  
  return url;
}

function getEmbedDimensions() {
  const widthInput = document.getElementById('embed-width');
  const widthUnit = document.getElementById('embed-width-unit');
  const heightInput = document.getElementById('embed-height');
  const heightUnit = document.getElementById('embed-height-unit');
  
  const width = `${widthInput.value}${widthUnit.value}`;
  const height = `${heightInput.value}${heightUnit.value}`;
  
  return { width, height };
}

function getEmbedBorderStyle() {
  const borderEnabledCheckbox = document.getElementById('embed-border-enabled');
  
  if (!borderEnabledCheckbox.checked) {
    return 'border:none;';
  }
  
  // Get current theme
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  const borderColor = theme === 'dark' ? '#c5c8c6' : '#4d4d4c'; // off-white for dark, dark grey for light
  
  return `border:1px solid ${borderColor};`;
}

function generateEmbedCode() {
  const url = getEmbedUrl();
  const { width, height } = getEmbedDimensions();
  const borderStyle = getEmbedBorderStyle();
  
  return `<iframe src="${url}" width="${width}" height="${height}" style="${borderStyle}" title="Ramah: Good news" loading="lazy"></iframe>`;
}

function updateEmbedCode() {
  const codeElement = document.getElementById('embed-code');
  codeElement.textContent = generateEmbedCode();
}

function updatePreview() {
  const preview = document.getElementById('embed-preview');
  const url = getEmbedUrl();
  const borderStyle = getEmbedBorderStyle();
  
  preview.innerHTML = `<iframe src="${url}" title="Ramah preview" loading="lazy" style="${borderStyle}"></iframe>`;
}

async function copyEmbedCode() {
  const code = generateEmbedCode();
  const copyBtn = document.getElementById('embed-copy-btn');
  const copyIcon = document.getElementById('copy-icon');
  const checkIcon = document.getElementById('check-icon');
  const copyText = document.getElementById('copy-text');
  
  try {
    await navigator.clipboard.writeText(code);
    
    // Show success state
    copyBtn.classList.add('copied');
    copyIcon.classList.add('hidden');
    checkIcon.classList.remove('hidden');
    copyText.textContent = 'Copied!';
    
    // Reset after 2 seconds
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyIcon.classList.remove('hidden');
      checkIcon.classList.add('hidden');
      copyText.textContent = 'Copy';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy embed code:', err);
    copyText.textContent = 'Failed';
    setTimeout(() => {
      copyText.textContent = 'Copy';
    }, 2000);
  }
}

// Menu Panel
function setupMenuPanel() {
  const menuToggle = document.getElementById('menu-toggle');
  const menuPanel = document.getElementById('menu-panel');
  const menuOverlay = document.getElementById('menu-overlay');
  const menuClose = document.getElementById('menu-close');
  
  const openMenu = () => {
    menuPanel.classList.add('open');
    menuOverlay.classList.remove('hidden');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    menuClose.focus();
  };
  
  const closeMenu = () => {
    menuPanel.classList.remove('open');
    menuOverlay.classList.add('hidden');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    menuToggle.focus();
  };
  
  menuToggle.addEventListener('click', openMenu);
  menuClose.addEventListener('click', closeMenu);
  menuOverlay.addEventListener('click', closeMenu);
  
  // Close menu when clicking menu items (except theme toggle)
  const menuItems = menuPanel.querySelectorAll('.menu-item:not(.menu-theme-item)');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      // Small delay to allow action to complete
      setTimeout(closeMenu, 100);
    });
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuPanel.classList.contains('open')) {
      closeMenu();
    }
  });
}

// Get Data Modal
function setupGetDataModal() {
  const modal = document.getElementById('get-data-modal');
  const openBtn = document.getElementById('get-data-btn');
  const closeBtn = document.getElementById('get-data-modal-close');
  
  if (!modal || !openBtn || !closeBtn) return;
  
  // Open modal
  openBtn.addEventListener('click', () => {
    window.location.hash = '#get-data';
  });
  
  // Close modal
  const closeModal = () => {
    window.location.hash = '#';
  };
  
  closeBtn.addEventListener('click', closeModal);
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  init();
  setupMenuPanel();
  setupEmbedModal();
  setupStatsModal();
  setupGetDataModal();
});
