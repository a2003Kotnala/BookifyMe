// --- AUTHENTICATION ---
const API_BASE_URL = 'http://localhost:5000/api';

function setupAuthModal() {
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    const authModalTitle = document.getElementById('auth-modal-title');
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const formToShow = tab.dataset.form;
            authModalTitle.textContent = formToShow === 'login' ? 'Sign In' : 'Create Account';
            authForms.forEach(form => form.classList.toggle('active', form.id === `${formToShow}-form`));
        });
    });
}

async function updateUIForAuth() {
    const actionsContainer = document.querySelector('.user-actions');
    const token = localStorage.getItem('bookifyToken');
    
    if (token) {
        try {
            // Verify token is still valid by getting user profile
            const response = await fetch(`${API_BASE_URL}/users/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                appState.currentUser = data.user;
                
                actionsContainer.innerHTML = `
                    <div id="user-profile" class="user-profile-card">
                        <div class="user-info">
                            <div class="user-avatar">${appState.currentUser.name.charAt(0).toUpperCase()}</div>
                            <div class="user-details">
                                <span class="user-name">${appState.currentUser.name}</span>
                                <span class="user-status">Online</span>
                            </div>
                        </div>
                        <button id="logout-btn" class="logout-btn">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                `;
                actionsContainer.querySelector('#logout-btn').addEventListener('click', handleLogout);
                myBooksLink.style.display = 'flex';
                profileLink.style.display = 'flex';
                
                // Load user's books
                await loadUserBooks();
                return;
            }
        } catch (error) {
            console.error('Error verifying token:', error);
        }
    }
    
    // If no valid token, show login button
    actionsContainer.innerHTML = `<button id="auth-btn">Login / Sign Up</button>`;
    actionsContainer.querySelector('#auth-btn').addEventListener('click', () => openModal('auth'));
    myBooksLink.style.display = 'none';
    profileLink.style.display = 'none';
}

async function handleLogin(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('bookifyToken', data.token);
            appState.currentUser = data.user;
            updateUIForAuth();
            closeModals();
            return true;
        } else {
            alert(data.error || 'Login failed');
            return false;
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
        return false;
    }
}

async function handleRegister(name, email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('bookifyToken', data.token);
            appState.currentUser = data.user;
            updateUIForAuth();
            closeModals();
            return true;
        } else {
            alert(data.error || 'Registration failed');
            return false;
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed. Please try again.');
        return false;
    }
}

async function handleLogout() {
    localStorage.removeItem('bookifyToken');
    appState.currentUser = null;
    appState.userShelves = { reading: [], wantToRead: [], history: [] };
    updateUIForAuth();
    switchTab('home');
}

async function loadUserBooks() {
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
            appState.userShelves.reading = data.books;
        }
        
        // Load want to read shelf
        const wantToReadResponse = await fetch(`${API_BASE_URL}/books/shelf/want_to_read`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (wantToReadResponse.ok) {
            const data = await wantToReadResponse.json();
            appState.userShelves.wantToRead = data.books;
        }
        
        // Load history shelf
        const historyResponse = await fetch(`${API_BASE_URL}/books/shelf/history`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (historyResponse.ok) {
            const data = await historyResponse.json();
            appState.userShelves.history = data.books;
        }
        
        updateBookshelves();
    } catch (error) {
        console.error('Error loading user books:', error);
    }
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
            const bookData = {
                id: book.id,
                volumeInfo: {
                    title: book.volumeInfo.title,
                    authors: book.volumeInfo.authors,
                    description: book.volumeInfo.description,
                    imageLinks: { thumbnail: book.volumeInfo.imageLinks?.thumbnail },
                    publishedDate: book.volumeInfo.publishedDate,
                    pageCount: book.volumeInfo.pageCount,
                    categories: book.volumeInfo.categories,
                    averageRating: book.volumeInfo.averageRating,
                    ratingsCount: book.volumeInfo.ratingsCount
                }
            };
            
            appState.userShelves[shelf].unshift(bookData);
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

// Update form submission handlers
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    await handleLogin(email, password);
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    await handleRegister(name, email, password);
});