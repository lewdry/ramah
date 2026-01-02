// App state (in-memory only)
let stories = [];
let currentIndex = 0;
const STORIES_PER_LOAD = 25;
const DATA_URL = 'https://lewdry.github.io/ramah-data/good_news.json';

// Track if stats have been calculated (lazy calculation)
let statsCalculated = false;

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
  } else {
    await showHomePage();
  }
}

async function showHomePage() {
  hideElement('page-stats');
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
  hideElement('page-home');
  hideElement('error-state');
  showElement('page-stats');
  
  // Only calculate stats when visiting the page (lazy calculation)
  if (!statsCalculated) {
    showElement('stats-loading');
    hideElement('stats-content');
    
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
}

function calculateAndDisplayStats() {
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
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid data format');
    }

    // Sort by timestamp descending (most recent first)
    stories = data.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateB - dateA;
    });

    hideElement('loading-indicator');
  } catch (error) {
    console.error('Failed to fetch stories:', error);
    hideElement('loading-indicator');
    stories = [];
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
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
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
}

// Infinite scroll handler
function setupInfiniteScroll() {
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrollPosition = window.innerHeight + window.scrollY;
        const threshold = document.body.offsetHeight - 200;

        if (scrollPosition >= threshold && currentIndex < stories.length) {
          showElement('loading-indicator');
          
          // Small delay for visual feedback
          setTimeout(() => {
            renderStories(STORIES_PER_LOAD);
            hideElement('loading-indicator');
          }, 150);
        }

        ticking = false;
      });

      ticking = true;
    }
  });
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
  
  // Open modal
  openBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateEmbedCode();
    updatePreview();
  });
  
  // Close modal
  const closeModal = () => {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
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

function generateEmbedCode() {
  const url = getEmbedUrl();
  const { width, height } = getEmbedDimensions();
  
  return `<iframe src="${url}" width="${width}" height="${height}" style="border:none;" title="Ramah: Good news" loading="lazy"></iframe>`;
}

function updateEmbedCode() {
  const codeElement = document.getElementById('embed-code');
  codeElement.textContent = generateEmbedCode();
}

function updatePreview() {
  const preview = document.getElementById('embed-preview');
  const url = getEmbedUrl();
  
  preview.innerHTML = `<iframe src="${url}" title="Ramah preview" loading="lazy"></iframe>`;
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

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  init();
  setupEmbedModal();
});
