// Constants
const JIKAN_API_BASE = 'https://api.jikan.moe/v4';
const MANGA_DETAIL_ENDPOINT = '/manga';
const MANGA_CHARACTERS_ENDPOINT = '/characters';
const MANGA_RECOMMENDATIONS_ENDPOINT = '/recommendations';
const LOCAL_STORAGE_KEY = 'myMangaList';

// DOM Elements
const mangaDetailContainer = document.getElementById('manga-detail');
const loadingIndicator = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const relatedMangaSection = document.getElementById('related-manga-section');
const relatedMangaGrid = document.getElementById('related-manga-grid');
const editModal = document.getElementById('edit-modal');
const closeModalBtn = document.getElementById('close-modal');
const saveChangesBtn = document.getElementById('save-changes');
const deleteMangaBtn = document.getElementById('delete-manga');
const editMangaInfo = document.getElementById('edit-manga-info');
const editStatusSelect = document.getElementById('edit-status');
const editScoreSelect = document.getElementById('edit-score');
const editProgressInput = document.getElementById('edit-progress');
const totalChaptersSpan = document.getElementById('total-chapters');
const editNotesTextarea = document.getElementById('edit-notes');
const modalTitle = document.getElementById('modal-title');

// Navigation search bar functionality
const navSearchInput = document.querySelector('header .search-bar input');
const navSearchButton = document.querySelector('header .search-bar button');

// Get manga ID from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const mangaId = urlParams.get('id');

// Main execution
document.addEventListener('DOMContentLoaded', () => {
    // Set up navigation search bar
    if (navSearchInput && navSearchButton) {
        navSearchButton.addEventListener('click', handleNavSearch);
        navSearchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                handleNavSearch();
            }
        });
    }

    // Check if we have a valid manga ID
    if (mangaId) {
        fetchMangaDetails(mangaId);
    } else {
        showError('No manga ID provided. Please go back and select a manga.');
    }

    // Add back-to-top button functionality
    setupBackToTopButton();
    
    // Setup user profile icon to navigate to My List
    const userProfileIcon = document.querySelector('.user-profile i');
    if (userProfileIcon) {
        userProfileIcon.addEventListener('click', () => {
            window.location.href = 'my-list.html';
        });
    }
    
    // Setup modal event listeners
    closeModalBtn.addEventListener('click', closeModal);
    saveChangesBtn.addEventListener('click', saveChanges);
    deleteMangaBtn.addEventListener('click', deleteManga);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeModal();
        }
    });
});

// Handle navigation search
function handleNavSearch() {
    const searchQuery = navSearchInput.value.trim();
    if (searchQuery) {
        // Redirect to browse page with search query
        window.location.href = `browse.html?search=${encodeURIComponent(searchQuery)}`;
    }
}

// Fetch manga details from API
async function fetchMangaDetails(id) {
    showLoading();
    
    try {
        // First fetch basic manga details
        const mangaResponse = await fetchWithRetry(`${JIKAN_API_BASE}${MANGA_DETAIL_ENDPOINT}/${id}/full`);
        const mangaData = await mangaResponse.json();
        
        if (!mangaData.data) {
            throw new Error('Failed to load manga details');
        }
        
        // Fetch characters (with a small delay to avoid rate limiting)
        setTimeout(async () => {
            try {
                const charactersResponse = await fetchWithRetry(`${JIKAN_API_BASE}${MANGA_DETAIL_ENDPOINT}/${id}${MANGA_CHARACTERS_ENDPOINT}`);
                const charactersData = await charactersResponse.json();
                
                // Fetch recommendations (with another small delay)
                setTimeout(async () => {
                    try {
                        const recommendationsResponse = await fetchWithRetry(`${JIKAN_API_BASE}${MANGA_DETAIL_ENDPOINT}/${id}${MANGA_RECOMMENDATIONS_ENDPOINT}`);
                        const recommendationsData = await recommendationsResponse.json();
                        
                        // Now render everything
                        renderMangaDetails(mangaData.data, charactersData.data, recommendationsData.data);
                        hideLoading();
                    } catch (error) {
                        // If recommendations fail, still show manga and characters
                        renderMangaDetails(mangaData.data, charactersData.data, []);
                        hideLoading();
                    }
                }, 1000);
            } catch (error) {
                // If characters fail, still show basic manga details
                renderMangaDetails(mangaData.data, [], []);
                hideLoading();
            }
        }, 1000);
    } catch (error) {
        console.error('Error fetching manga details:', error);
        showError('Failed to load manga details. Please try again later.');
    }
}

// Fetch with retry for rate limiting
async function fetchWithRetry(url, retries = 3, delay = 1000) {
    try {
        const response = await fetch(url);
        
        // Handle rate limiting
        if (response.status === 429 && retries > 0) {
            console.log(`Rate limited, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, retries - 1, delay * 1.5);
        }
        
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }
        
        return response;
    } catch (error) {
        if (retries > 0) {
            console.log(`Error fetching, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, retries - 1, delay * 1.5);
        }
        throw error;
    }
}

// Render manga details in the page
function renderMangaDetails(manga, characters = [], recommendations = []) {
    // Set the page title
    document.title = `${manga.title} - MyMangaList`;
    
    // Create the main details content
    let detailHTML = `
        <!-- Removed the banner image as requested -->
        <div class="manga-banner-placeholder"></div>
        
        <div class="manga-content">
            <!-- Left column: Cover Image -->
            <div class="manga-cover-container">
                <div class="manga-cover-large">
                    <img src="${manga.images.jpg.large_image_url || manga.images.jpg.image_url}" alt="${manga.title}">
                </div>
                
                <!-- Information Box -->
                <div class="manga-information">
                    <h2>Information</h2>
                    <div class="info-table">
                        <div class="info-label">Format</div>
                        <div class="info-value">${manga.type || 'Unknown'}</div>
                        
                        <div class="info-label">Status</div>
                        <div class="info-value">${formatStatus(manga.status)}</div>
                        
                        <div class="info-label">Published</div>
                        <div class="info-value">${formatPublishDates(manga.published)}</div>
                        
                        <div class="info-label">Chapters</div>
                        <div class="info-value">${manga.chapters || 'Unknown'}</div>
                        
                        <div class="info-label">Volumes</div>
                        <div class="info-value">${manga.volumes || 'Unknown'}</div>
                        
                        ${manga.authors && manga.authors.length > 0 ? `
                        <div class="info-label">Authors</div>
                        <div class="info-value">${formatAuthors(manga.authors)}</div>
                        ` : ''}
                        
                        ${manga.serializations && manga.serializations.length > 0 ? `
                        <div class="info-label">Serialization</div>
                        <div class="info-value">${formatSerializations(manga.serializations)}</div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <!-- Right column: Details -->
            <div class="manga-info-section">
                <!-- Title Section -->
                <div class="manga-title-section">
                    <h1>${manga.title}</h1>
                    ${manga.title_english && manga.title_english !== manga.title ? `
                    <div class="manga-alt-titles">
                        English: ${manga.title_english}
                    </div>
                    ` : ''}
                </div>
                
                <!-- Meta Info (type, status, etc) -->
                <div class="manga-meta">
                    <div class="manga-meta-item">
                        <i class="fas fa-book"></i> ${manga.type || 'Manga'}
                    </div>
                    <div class="manga-meta-item">
                        <i class="fas fa-clock"></i> ${formatStatus(manga.status)}
                    </div>
                    <div class="manga-meta-item">
                        <i class="fas fa-calendar"></i> ${formatYearSeason(manga.published)}
                    </div>
                </div>
                
                <!-- Genres -->
                ${manga.genres && manga.genres.length > 0 ? `
                <div class="manga-genres">
                    ${manga.genres.map(genre => `
                        <span class="genre-tag">${genre.name}</span>
                    `).join('')}
                </div>
                ` : ''}
                
                <!-- Score Section -->
                <div class="manga-score-section">
                    <div class="score-display">
                        <div class="score-value">${manga.score ? manga.score.toFixed(1) : 'N/A'}</div>
                        <div class="score-label">SCORE</div>
                    </div>
                    
                    <div class="rating-stats">
                        <div class="rating-item">
                            <div class="rating-label">Popularity</div>
                            <div class="rating-count">#${manga.popularity || 'N/A'}</div>
                        </div>
                        <div class="rating-item">
                            <div class="rating-label">Members</div>
                            <div class="rating-count">${formatNumber(manga.members || 0)}</div>
                        </div>
                        <div class="rating-item">
                            <div class="rating-label">Favorites</div>
                            <div class="rating-count">${formatNumber(manga.favorites || 0)}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Action Button -->
                <div class="manga-actions">
                    <button class="action-button" id="add-to-list-btn">
                        <i class="fas fa-plus"></i> Add to List
                    </button>
                </div>
                
                <!-- Synopsis -->
                <div class="manga-synopsis">
                    <h2>Synopsis</h2>
                    ${manga.synopsis ? `<p>${manga.synopsis}</p>` : '<p>No synopsis available.</p>'}
                </div>
                
                <!-- Background Info (if available) -->
                ${manga.background ? `
                <div class="manga-synopsis">
                    <h2>Background</h2>
                    <p>${manga.background}</p>
                </div>
                ` : ''}
                
                <!-- Characters Section -->
                ${characters && characters.length > 0 ? `
                <div class="manga-characters">
                    <h2>Characters</h2>
                    <div class="characters-grid">
                        ${characters.slice(0, 8).map(char => `
                            <div class="character-card">
                                <div class="character-image">
                                    <img src="${char.character.images.jpg.image_url}" alt="${char.character.name}">
                                </div>
                                <div class="character-info">
                                    <div class="character-name">${char.character.name}</div>
                                    <div class="character-role">${char.role}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
        
        <!-- Back to top button -->
        <div class="back-to-top" id="back-to-top">
            <i class="fas fa-arrow-up"></i>
        </div>
    `;
    
    // Display the manga details
    mangaDetailContainer.innerHTML = detailHTML;
    mangaDetailContainer.style.display = 'block';
    
    // Setup the add to list button functionality
    setupAddToListButton(manga);
    
    // Render related manga if available
    if (recommendations && recommendations.length > 0) {
        renderRelatedManga(recommendations);
    }
    
    // Initialize back-to-top button behavior
    document.getElementById('back-to-top').addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Render related manga section
function renderRelatedManga(recommendations) {
    if (recommendations.length === 0) return;
    
    // Clear existing content
    relatedMangaGrid.innerHTML = '';
    
    // Add recommendation cards (max 6)
    recommendations.slice(0, 6).forEach(rec => {
        const manga = rec.entry;
        const card = document.createElement('div');
        card.className = 'manga-card';
        
        card.innerHTML = `
            <div class="manga-cover">
                <img src="${manga.images.jpg.image_url}" alt="${manga.title}" loading="lazy">
                <div class="manga-rating">
                    <i class="fas fa-thumbs-up"></i> ${rec.votes || 0}
                </div>
            </div>
            <div class="manga-info">
                <div class="manga-title" title="${manga.title}">${manga.title}</div>
            </div>
        `;
        
        // Add click event to navigate to the manga's detail page
        card.addEventListener('click', () => {
            window.location.href = `manga-detail.html?id=${manga.mal_id}`;
        });
        
        relatedMangaGrid.appendChild(card);
    });
    
    // Show the related manga section
    relatedMangaSection.style.display = 'block';
}

// Format publish dates
function formatPublishDates(published) {
    if (!published || (!published.from && !published.to)) return 'Unknown';
    
    let result = '';
    
    if (published.from) {
        const fromDate = new Date(published.from);
        result += formatDate(fromDate);
    } else {
        result += '?';
    }
    
    result += ' to ';
    
    if (published.to) {
        const toDate = new Date(published.to);
        result += formatDate(toDate);
    } else {
        result += 'Present';
    }
    
    return result;
}

// Format a date object
function formatDate(date) {
    if (!date || isNaN(date.getTime())) return 'Unknown';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Format year and season from published info
function formatYearSeason(published) {
    if (!published || !published.from) return 'Unknown';
    
    const fromDate = new Date(published.from);
    if (isNaN(fromDate.getTime())) return 'Unknown';
    
    return fromDate.getFullYear().toString();
}

// Format status string
function formatStatus(status) {
    if (!status) return 'Unknown';
    
    // Capitalize first letter of each word
    return status.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
}

// Format authors array
function formatAuthors(authors) {
    if (!authors || authors.length === 0) return 'Unknown';
    return authors.map(author => author.name).join(', ');
}

// Format serializations array
function formatSerializations(serializations) {
    if (!serializations || serializations.length === 0) return 'Unknown';
    return serializations.map(serial => serial.name).join(', ');
}

// Format numbers with comma separators for thousands
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Setup the back to top button
function setupBackToTopButton() {
    const backToTopBtn = document.createElement('div');
    backToTopBtn.className = 'back-to-top';
    backToTopBtn.id = 'back-to-top';
    backToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    document.body.appendChild(backToTopBtn);
    
    // Show the button when user scrolls down
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });
    
    // Scroll to top when button is clicked
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Show loading indicator
function showLoading() {
    loadingIndicator.style.display = 'flex';
    mangaDetailContainer.style.display = 'none';
    errorMessage.style.display = 'none';
    relatedMangaSection.style.display = 'none';
}

// Hide loading indicator
function hideLoading() {
    loadingIndicator.style.display = 'none';
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    loadingIndicator.style.display = 'none';
    mangaDetailContainer.style.display = 'none';
}

// Check if manga is in user's list
function isMangaInList(id) {
    const savedList = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!savedList) return false;
    
    const myList = JSON.parse(savedList);
    return myList.some(manga => manga.id === parseInt(id));
}

// Get manga status from user's list
function getMangaStatus(id) {
    const savedList = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!savedList) return null;
    
    const myList = JSON.parse(savedList);
    const manga = myList.find(m => m.id === parseInt(id));
    return manga ? manga.status : null;
}

// Add manga to user's list
function addMangaToList(manga, status) {
    // Get current list or initialize empty array
    const savedList = localStorage.getItem(LOCAL_STORAGE_KEY);
    const myList = savedList ? JSON.parse(savedList) : [];
    
    // Check if manga is already in list
    const existingIndex = myList.findIndex(m => m.id === manga.mal_id);
    
    if (existingIndex !== -1) {
        // Update status if manga exists
        myList[existingIndex].status = status;
    } else {
        // Add new manga to list
        const newManga = {
            id: manga.mal_id,
            title: manga.title,
            type: manga.type || 'Unknown',
            imageUrl: manga.images.jpg.image_url,
            year: manga.published ? new Date(manga.published.from).getFullYear() : null,
            totalChapters: manga.chapters,
            status: status,
            score: 0,
            progress: 0,
            notes: '',
            dateAdded: new Date().toISOString()
        };
        
        myList.push(newManga);
    }
    
    // Save updated list
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(myList));
    
    return true;
}

// Setup add to list button and modal
function setupAddToListButton(manga) {
    const addToListBtn = document.getElementById('add-to-list-btn');
    
    if (!addToListBtn) return;
    
    // Check if manga is already in list
    const inList = isMangaInList(manga.mal_id);
    const currentStatus = getMangaStatus(manga.mal_id);
    
    // Update button appearance and text
    if (inList && currentStatus) {
        addToListBtn.classList.add('in-list');
        addToListBtn.innerHTML = `<i class="fas fa-edit"></i> Edit in My List`;
        modalTitle.textContent = 'Edit Manga';
    } else {
        addToListBtn.innerHTML = `<i class="fas fa-plus"></i> Add to List`;
        modalTitle.textContent = 'Add to My List';
    }
    
    // Open modal when button is clicked
    addToListBtn.addEventListener('click', () => {
        openEditModal(manga);
    });
}

// Open the edit modal for a manga
function openEditModal(manga) {
    // Get current manga data if it exists in the list
    const inList = isMangaInList(manga.mal_id);
    let currentData = null;
    
    if (inList) {
        const savedList = localStorage.getItem(LOCAL_STORAGE_KEY);
        const myList = JSON.parse(savedList);
        currentData = myList.find(m => m.id === parseInt(manga.mal_id));
    }
    
    // Populate manga info
    editMangaInfo.innerHTML = `
        <div class="edit-manga-cover">
            <img src="${manga.images.jpg.image_url}" alt="${manga.title}">
        </div>
        <div class="edit-manga-details">
            <div class="edit-manga-title">${manga.title}</div>
            <div class="edit-manga-subtitle">${manga.type || 'Unknown'} · ${manga.published ? new Date(manga.published.from).getFullYear() : 'Unknown'}</div>
        </div>
    `;
    
    // Set form values
    editStatusSelect.value = currentData ? currentData.status : 'plan-to-read';
    editScoreSelect.value = currentData ? currentData.score : '0';
    editProgressInput.value = currentData ? currentData.progress : 0;
    totalChaptersSpan.textContent = manga.chapters || '?';
    editNotesTextarea.value = currentData ? currentData.notes : '';
    
    // Handle delete button visibility
    if (inList) {
        deleteMangaBtn.style.display = 'block';
    } else {
        deleteMangaBtn.style.display = 'none';
    }
    
    // Show the modal
    editModal.style.display = 'flex';
}

// Close the edit modal
function closeModal() {
    editModal.style.display = 'none';
}

// Save changes from the edit modal
function saveChanges() {
    const manga = getCurrentMangaDetails();
    if (!manga) return;
    
    // Get values from the form
    const status = editStatusSelect.value;
    const score = parseInt(editScoreSelect.value) || 0;
    const progress = parseInt(editProgressInput.value) || 0;
    const notes = editNotesTextarea.value;
    
    // Get current list or initialize empty array
    const savedList = localStorage.getItem(LOCAL_STORAGE_KEY);
    const myList = savedList ? JSON.parse(savedList) : [];
    
    // Check if manga is already in list
    const existingIndex = myList.findIndex(m => m.id === manga.mal_id);
    
    if (existingIndex !== -1) {
        // Update existing manga
        myList[existingIndex].status = status;
        myList[existingIndex].score = score;
        myList[existingIndex].progress = progress;
        myList[existingIndex].notes = notes;
    } else {
        // Add new manga to list
        const newManga = {
            id: manga.mal_id,
            title: manga.title,
            type: manga.type || 'Unknown',
            imageUrl: manga.images.jpg.image_url,
            year: manga.published ? new Date(manga.published.from).getFullYear() : null,
            totalChapters: manga.chapters,
            status: status,
            score: score,
            progress: progress,
            notes: notes,
            dateAdded: new Date().toISOString()
        };
        
        myList.push(newManga);
    }
    
    // Save updated list
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(myList));
    
    // Update Add to List button
    const addToListBtn = document.getElementById('add-to-list-btn');
    if (addToListBtn) {
        addToListBtn.classList.add('in-list');
        addToListBtn.innerHTML = `<i class="fas fa-edit"></i> Edit in My List`;
    }
    
    // Close the modal
    closeModal();
    
    // Show success message
    const actionText = existingIndex !== -1 ? 'updated' : 'added to';
    alert(`"${manga.title}" has been ${actionText} your list.`);
}

// Delete manga from the list
function deleteManga() {
    const manga = getCurrentMangaDetails();
    if (!manga) return;
    
    // Confirm deletion
    if (confirm(`Are you sure you want to remove "${manga.title}" from your list?`)) {
        // Get current list
        const savedList = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!savedList) return;
        
        let myList = JSON.parse(savedList);
        
        // Remove manga from list
        myList = myList.filter(m => m.id !== manga.mal_id);
        
        // Save updated list
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(myList));
        
        // Update Add to List button
        const addToListBtn = document.getElementById('add-to-list-btn');
        if (addToListBtn) {
            addToListBtn.classList.remove('in-list');
            addToListBtn.innerHTML = `<i class="fas fa-plus"></i> Add to List`;
        }
        
        // Close the modal
        closeModal();
        
        // Show success message
        alert(`"${manga.title}" has been removed from your list.`);
    }
}

// Get current manga details from the page
function getCurrentMangaDetails() {
    try {
        const title = document.querySelector('.manga-title-section h1').textContent;
        const mal_id = parseInt(mangaId);
        
        // Get other details (we may need to fetch these from API again)
        const type = document.querySelector('.manga-meta-item:nth-child(1)').textContent.trim();
        const chapters = totalChaptersSpan.textContent !== '?' ? parseInt(totalChaptersSpan.textContent) : null;
        
        // Get image URL from edit modal
        const imageUrl = document.querySelector('.edit-manga-cover img').src;
        
        // Build a partial manga object with essential details
        return {
            mal_id,
            title,
            type,
            chapters,
            images: {
                jpg: {
                    image_url: imageUrl
                }
            }
        };
    } catch (error) {
        console.error('Error getting current manga details:', error);
        return null;
    }
}

// Format status text for display
function formatStatusText(status) {
    const statusMap = {
        'reading': 'Reading',
        'completed': 'Completed',
        'on-hold': 'On Hold',
        'dropped': 'Dropped',
        'plan-to-read': 'Plan to Read'
    };
    
    return statusMap[status] || status;
}