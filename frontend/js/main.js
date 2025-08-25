// --- CONFIGURATION ---
const API_BASE_URL = 'http://localhost:5000/api';

// --- DOM ELEMENTS ---
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const menuToggle = document.getElementById('menu-toggle');
const mainWrapper = document.querySelector('.main-wrapper');
const navLinks = document.querySelectorAll('.nav-link');
const tabContents = document.querySelectorAll('.tab-content');
const myBooksLink = document.getElementById('my-books-link');
const profileLink = document.getElementById('profile-link');
const modals = document.querySelectorAll('.modal');
const closeModalButtons = document.querySelectorAll('.close-modal');
const searchInput = document.getElementById('search-input');
const searchSuggestions = document.getElementById('search-suggestions');
const searchOptions = document.querySelector('.search-options');

// --- APP STATE ---
let appState = {
    currentUser: null,
    userShelves: { reading: [], wantToRead: [], history: [] },
    joinedGroups: new Set(),
    searchTimeout: null,
    currentSearchQuery: ''
};

// --- API FUNCTIONS ---
async function fetchBooks(query, params = {}, limit = 10) {
    try {
        // Build query string
        const urlParams = new URLSearchParams({
            q: query,
            limit: limit
        });
        
        if (params.orderBy && params.orderBy !== 'relevance') urlParams.append('orderBy', params.orderBy);
        if (params.printType && params.printType !== 'all') urlParams.append('printType', params.printType);
        if (params.langRestrict && params.langRestrict !== 'any') urlParams.append('langRestrict', params.langRestrict);

        const response = await fetch(`${API_BASE_URL}/books/search?${urlParams.toString()}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        // Convert API response to format expected by the UI
        return data.books.map(book => ({
            id: book.id,
            volumeInfo: {
                title: book.title,
                authors: book.authors,
                description: book.description,
                imageLinks: { thumbnail: book.thumbnail },
                publishedDate: book.publishedDate,
                pageCount: book.pageCount,
                categories: book.categories,
                averageRating: book.averageRating,
                ratingsCount: book.ratingsCount
            },
            accessInfo: {
                webReaderLink: `https://books.google.com/books?id=${book.id}&pg=GBS.PP1&dq=${encodeURIComponent(query)}&hl=&cd=1&source=gbs_api`
            }
        }));
    } catch (error) {
        console.error('Error fetching books:', error);
        return [];
    }
}

// --- UI RENDERING ---
function createBookCard(book, cardType = 'standard') {
    const volumeInfo = book.volumeInfo;
    const title = volumeInfo.title || 'No Title';
    
    let author = 'Unknown Author';
    if (volumeInfo.authors && volumeInfo.authors.length > 0) {
        author = volumeInfo.authors.length > 2 ? 
            `${volumeInfo.authors.slice(0, 2).join(', ')} et al.` : 
            volumeInfo.authors.join(', ');
    }

    let imageUrl = volumeInfo.imageLinks?.thumbnail || `https://placehold.co/220x300/6a11cb/ffffff?text=${encodeURIComponent(title.charAt(0))}`;
    imageUrl = imageUrl.replace('http://', 'https://');

    const readLink = book.accessInfo?.webReaderLink;
    const card = document.createElement('div');
    card.className = (cardType === 'small' || cardType === 'reading') ? 'book-card small-book-card' : 'book-card';
    
    let actionsHtml = `<button class="add-to-shelf-btn" title="Add to shelf"><i class="fas fa-plus"></i></button>`;
    if (cardType === 'reading') {
        actionsHtml = `<button class="mark-as-read-btn" title="Mark as Read"><i class="fas fa-check"></i></button>`;
    }
    if (readLink) {
        actionsHtml += `<a href="${readLink}" target="_blank" class="read-now-btn" title="Read Now"><i class="fas fa-book-reader"></i></a>`;
    }

    card.innerHTML = `
        <div class="book-cover">
            <img src="${imageUrl}" alt="${title}" onerror="this.src='https://placehold.co/220x300/e9ecef/6c757d?text=No+Image'">
        </div>
        <div class="book-info">
            <div class="book-details">
               <h3 class="book-title" title="${title}">${title}</h3>
               <p class="book-author">${author}</p>
            </div>
            <div class="book-actions">${actionsHtml}</div>
        </div>
    `;
    
    card.querySelector('.add-to-shelf-btn')?.addEventListener('click', e => { 
        e.stopPropagation(); 
        if (!appState.currentUser) { 
            openModal('auth'); 
            return; 
        } 
        openShelfModal(book); 
    });
    
    card.querySelector('.read-now-btn')?.addEventListener('click', e => { 
        if (!appState.currentUser) { 
            e.preventDefault(); 
            openModal('auth'); 
            return; 
        } 
        addBookToShelf(book, 'reading'); 
    });
    
    card.querySelector('.mark-as-read-btn')?.addEventListener('click', e => { 
        e.stopPropagation(); 
        markBookAsRead(book); 
    });
    
    return card;
}

function renderBooks(containerId, books, cardType = 'standard') {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (!books || books.length === 0) {
        if (containerId.includes('search')) {
            container.innerHTML = `<div class="empty-state col-span-full"><p>No books found for your query.</p></div>`;
        } else {
            container.innerHTML = `<div class="empty-state col-span-full"><p>No books here yet.</p></div>`;
        }
        return;
    }

    if (container.parentElement.classList.contains('scrolling-wrapper')) {
        container.classList.remove('books-container');
        container.classList.add('scroll-track');
        const allCards = [...books, ...books].map(book => createBookCard(book, cardType));
        allCards.forEach(card => container.appendChild(card));
    } else {
        container.classList.add('books-container');
        container.classList.remove('scroll-track');
        books.forEach(book => container.appendChild(createBookCard(book, cardType)));
    }
}

// --- SIDEBAR & NAVIGATION (UPGRADED) ---
function toggleSidebar() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
    mainWrapper.classList.toggle('sidebar-open');
}
menuToggle.addEventListener('click', toggleSidebar);
overlay.addEventListener('click', toggleSidebar);

function showTab(tabName) {
    navLinks.forEach(link => link.classList.toggle('active', link.dataset.tab === tabName));
    tabContents.forEach(tab => tab.classList.toggle('active', tab.id === tabName));
    window.scrollTo(0, 0);
    if (sidebar.classList.contains('open')) toggleSidebar();
}

function switchTab(tabName) {
    const state = { tab: tabName };
    const url = `#${tabName}`;
    history.pushState(state, '', url);
    showTab(tabName);
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(link.dataset.tab);
    });
});

document.getElementById('explore-now-btn').addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('browse');
});
document.querySelector('.header-logo').addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('home');
});

window.addEventListener('popstate', (e) => {
    const tab = e.state?.tab || 'home';
    showTab(tab);
});

// --- MODALS ---
function openModal(modalId) { document.getElementById(`${modalId}-modal`).style.display = 'flex'; }
function closeModals() { modals.forEach(modal => modal.style.display = 'none'); }
closeModalButtons.forEach(btn => btn.addEventListener('click', closeModals));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

// --- BOOKSHELF & PROFILE ---
function openShelfModal(book) {
    const shelfOptions = document.getElementById('shelf-options');
    shelfOptions.innerHTML = `<button class="btn btn-primary add-to-shelf-option" data-shelf="reading">Currently Reading</button><button class="btn btn-primary add-to-shelf-option" data-shelf="wantToRead">Want to Read</button><button class="btn btn-primary add-to-shelf-option" data-shelf="history">Add to History</button>`;
    shelfOptions.querySelectorAll('.add-to-shelf-option').forEach(btn => {
        btn.addEventListener('click', () => { addBookToShelf(book, btn.dataset.shelf); closeModals(); });
    });
    openModal('shelf');
}

async function addBookToShelf(book, shelf) {
    const token = localStorage.getItem('bookifyToken');
    if (!token) {
        openModal('auth');
        return false;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/books/shelf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                book: {
                    id: book.id,
                    title: book.volumeInfo.title,
                    authors: book.volumeInfo.authors,
                    description: book.volumeInfo.description,
                    thumbnail: book.volumeInfo.imageLinks?.thumbnail,
                    publishedDate: book.volumeInfo.publishedDate,
                    pageCount: book.volumeInfo.pageCount,
                    categories: book.volumeInfo.categories,
                    averageRating: book.volumeInfo.averageRating,
                    ratingsCount: book.volumeInfo.ratingsCount
                },
                shelf_type: shelf
            })
        });
        
        if (response.ok) {
            // Update local state
            Object.keys(appState.userShelves).forEach(key => {
                appState.userShelves[key] = appState.userShelves[key].filter(b => b.id !== book.id);
            });
            
            // Add to the appropriate shelf
            appState.userShelves[shelf].unshift(book);
            updateBookshelves();
            return true;
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to add book to shelf');
            return false;
        }
    } catch (error) {
        console.error('Error adding book to shelf:', error);
        alert('Failed to add book to shelf. Please try again.');
        return false;
    }
}

async function markBookAsRead(book) {
    const success = await addBookToShelf(book, 'history');
    if (success) {
        // Remove from reading shelf in local state
        appState.userShelves.reading = appState.userShelves.reading.filter(b => b.id !== book.id);
        updateBookshelves();
    }
}

async function updateBookshelves() {
    const token = localStorage.getItem('bookifyToken');
    if (!token) return;
    
    try {
        // Load reading shelf
        const readingResponse = await fetch(`${API_BASE_URL}/books/shelf/reading`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (readingResponse.ok) {
            const data = await readingResponse.json();
            appState.userShelves.reading = data.books.map(book => ({
                id: book.id,
                volumeInfo: {
                    title: book.title,
                    authors: book.authors,
                    description: book.description,
                    imageLinks: { thumbnail: book.thumbnail },
                    publishedDate: book.publishedDate,
                    pageCount: book.pageCount,
                    categories: book.categories,
                    averageRating: book.averageRating,
                    ratingsCount: book.ratingsCount
                }
            }));
        }
        
        // Load want to read shelf
        const wantToReadResponse = await fetch(`${API_BASE_URL}/books/shelf/want_to_read`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (wantToReadResponse.ok) {
            const data = await wantToReadResponse.json();
            appState.userShelves.wantToRead = data.books.map(book => ({
                id: book.id,
                volumeInfo: {
                    title: book.title,
                    authors: book.authors,
                    description: book.description,
                    imageLinks: { thumbnail: book.thumbnail },
                    publishedDate: book.publishedDate,
                    pageCount: book.pageCount,
                    categories: book.categories,
                    averageRating: book.averageRating,
                    ratingsCount: book.ratingsCount
                }
            }));
        }
        
        // Load history shelf
        const historyResponse = await fetch(`${API_BASE_URL}/books/shelf/history`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (historyResponse.ok) {
            const data = await historyResponse.json();
            appState.userShelves.history = data.books.map(book => ({
                id: book.id,
                volumeInfo: {
                    title: book.title,
                    authors: book.authors,
                    description: book.description,
                    imageLinks: { thumbnail: book.thumbnail },
                    publishedDate: book.publishedDate,
                    pageCount: book.pageCount,
                    categories: book.categories,
                    averageRating: book.averageRating,
                    ratingsCount: book.ratingsCount
                }
            }));
        }
        
        // Update UI
        renderBooks('shelf-reading', appState.userShelves.reading, 'reading');
        renderBooks('shelf-want-to-read', appState.userShelves.wantToRead, 'small');
        renderBooks('shelf-history', appState.userShelves.history, 'small');
    } catch (error) {
        console.error('Error updating bookshelves:', error);
    }
}

async function updateProfileDashboard() {
    const token = localStorage.getItem('bookifyToken');
    if (!token || !appState.currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const { name, email } = appState.currentUser;
            
            document.getElementById('profile-avatar').textContent = name.charAt(0).toUpperCase();
            document.getElementById('profile-name').textContent = name;
            document.getElementById('profile-email').textContent = email;

            document.getElementById('stats-books-read').textContent = data.stats.booksRead;
            document.getElementById('stats-pages-read').textContent = data.stats.pagesRead.toLocaleString();
            document.getElementById('stats-genres').textContent = data.stats.genresExplored;
            document.getElementById('stats-groups').textContent = data.stats.groups;
        }
    } catch (error) {
        console.error('Error updating profile dashboard:', error);
    }
}

// --- SEARCH & SUGGESTIONS (UPGRADED) ---
async function handleSearch() {
    const query = searchInput.value.trim();
    appState.currentSearchQuery = query;
    searchSuggestions.style.display = 'none';
    
    if (!query) {
        document.getElementById('search-results-container').innerHTML = '';
        return;
    }

    const container = document.getElementById('search-results-container');
    container.innerHTML = '<div class="loading col-span-full"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';

    const searchParams = {
        orderBy: document.getElementById('sort-by').value,
        printType: document.getElementById('print-type').value,
        langRestrict: document.getElementById('language').value
    };

    try {
        const books = await fetchBooks(query, searchParams, 40);
        renderBooks('search-results-container', books);
    } catch (error) {
        console.error('Search error:', error);
        container.innerHTML = `<div class="empty-state col-span-full"><p>Search failed. Please try again.</p></div>`;
    }
}

async function fetchAndShowSuggestions() {
    const query = searchInput.value.trim();
    if (query.length < 3) { 
        searchSuggestions.style.display = 'none'; 
        return; 
    }
    
    const books = await fetchBooks(query, {}, 5);
    searchSuggestions.innerHTML = '';
    
    if (books.length > 0) {
        books.forEach(book => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = book.volumeInfo.title;
            item.addEventListener('click', () => { 
                searchInput.value = book.volumeInfo.title; 
                handleSearch(); 
            });
            searchSuggestions.appendChild(item);
        });
        searchSuggestions.style.display = 'block';
    } else {
        searchSuggestions.style.display = 'none';
    }
}

document.getElementById('search-button').addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
searchInput.addEventListener('input', () => {
    clearTimeout(appState.searchTimeout);
    appState.searchTimeout = setTimeout(fetchAndShowSuggestions, 300);
});

searchOptions.addEventListener('change', () => {
    if (searchInput.value.trim()) {
        handleSearch();
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar')) { 
        searchSuggestions.style.display = 'none'; 
    }
});

// --- CATEGORIES & COMMUNITY ---
function renderCategories() {
    const categories = [
        { name: 'Fantasy', icon: 'fa-dragon' }, { name: 'Science Fiction', icon: 'fa-rocket' },
        { name: 'Mystery', icon: 'fa-search' }, { name: 'Romance', icon: 'fa-heart' },
        { name: 'History', icon: 'fa-monument' }, { name: 'Technology', icon: 'fa-laptop-code' },
        { name: 'Biography', icon: 'fa-user-tie' }, { name: 'Cooking', icon: 'fa-utensils' },
    ];
    const grid = document.querySelector('#categories .categories-grid');
    grid.innerHTML = categories.map(cat => `
        <div class="category-card" data-category="${cat.name}">
            <div class="category-icon"><i class="fas ${cat.icon}"></i></div>
            <h3>${cat.name}</h3>
        </div>`).join('');
    
    grid.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            switchTab('browse');
            searchInput.value = `subject:"${card.dataset.category}"`;
            handleSearch();
        });
    });
}

function renderCommunityGroups() {
    const groups = [
        { id: 'scifi', name: 'Sci-Fi Enthusiasts', members: '2,341', icon: 'fa-rocket' },
        { id: 'mystery', name: 'Mystery Book Club', members: '1,897', icon: 'fa-search' },
        { id: 'fantasy', name: 'Fantasy Readers', members: '1,542', icon: 'fa-dragon' },
    ];
    const container = document.querySelector('.groups-container');
    container.innerHTML = '';
    
    groups.forEach(group => {
        const isJoined = appState.joinedGroups.has(group.id);
        const card = document.createElement('div');
        card.className = 'group-card';
        card.innerHTML = `<div class="group-icon"><i class="fas ${group.icon}"></i></div><div class="group-info"><h3>${group.name}</h3><p>${group.members} members</p></div><button class="btn ${isJoined ? '' : 'btn-primary'} join-group-btn" data-group-id="${group.id}">${isJoined ? 'Joined' : 'Join'}</button>`;
        container.appendChild(card);
    });
    
    container.querySelectorAll('.join-group-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!appState.currentUser) { 
                openModal('auth'); 
                return; 
            }
            const groupId = btn.dataset.groupId;
            if (appState.joinedGroups.has(groupId)) { 
                appState.joinedGroups.delete(groupId); 
            } else { 
                appState.joinedGroups.add(groupId); 
            }
            localStorage.setItem('bookifyGroups', JSON.stringify(Array.from(appState.joinedGroups)));
            renderCommunityGroups();
            updateProfileDashboard();
        });
    });
}

// --- INITIALIZATION ---
async function init() {
    // Restore user state from localStorage
    const storedUser = localStorage.getItem('bookifyUser');
    const storedGroups = localStorage.getItem('bookifyGroups');
    
    if (storedUser) {
        appState.currentUser = JSON.parse(storedUser);
        appState.joinedGroups = new Set(JSON.parse(storedGroups || '[]'));
    }
    
    // Set up UI components
    setupAuthModal();
    updateUIForAuth();
    renderCategories();
    renderCommunityGroups();

    // Handle initial tab based on URL hash
    const initialTab = window.location.hash.substring(1) || 'home';
    showTab(initialTab);

    // Fetch initial content for the homepage
    try {
        // Fetch trending books
        const trendingResponse = await fetch(`${API_BASE_URL}/books/trending`);
        if (trendingResponse.ok) {
            const data = await trendingResponse.json();
            const trendingBooks = data.books.map(book => ({
                id: book.id,
                volumeInfo: {
                    title: book.title,
                    authors: book.authors,
                    imageLinks: { thumbnail: book.thumbnail }
                }
            }));
            renderBooks('trending-books-container', trendingBooks);
        }
        
        // Fetch new releases
        const newReleasesResponse = await fetch(`${API_BASE_URL}/books/new-releases`);
        if (newReleasesResponse.ok) {
            const data = await newReleasesResponse.json();
            const newReleases = data.books.map(book => ({
                id: book.id,
                volumeInfo: {
                    title: book.title,
                    authors: book.authors,
                    imageLinks: { thumbnail: book.thumbnail }
                }
            }));
            renderBooks('new-releases-container', newReleases);
        }
    } catch (error) {
        console.error('Error loading initial books:', error);
        
        // Fallback to Google Books API if our API is not available
        const trendingBooks = await fetchBooks('bestselling fiction 2024', {}, 12);
        renderBooks('trending-books-container', trendingBooks);
        
        const newReleases = await fetchBooks('new release books', { orderBy: 'newest'}, 12);
        renderBooks('new-releases-container', newReleases);
    }
}

// Initialize the app when the DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}