// App state (in-memory only)
let stories = [];
let currentIndex = 0;
const STORIES_PER_LOAD = 25;
const DATA_URL = 'https://lewdry.github.io/ramah-data/good_news.json';

// Initialization
async function init() {
  loadThemePreference();
  setupThemeToggle();
  await fetchStories();

  if (stories.length > 0) {
    hideElement('error-state');
    hideElement('loading-indicator');
    renderStories(STORIES_PER_LOAD);
    setupInfiniteScroll();
  } else {
    showErrorState();
  }
}

// Theme Management
function loadThemePreference() {
  let savedTheme = localStorage.getItem('ramah-theme');
  
  // If no saved preference, use system preference
  if (!savedTheme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    savedTheme = prefersDark ? 'dark' : 'light';
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

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
