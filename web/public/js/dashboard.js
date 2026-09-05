

let badges = [];
let categories = [];
let editingBadgeId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadBadges();
  setupTabSwitching();
  setupForms();
});

// Tab Switching
function setupTabSwitching() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      
      item.classList.add('active');
      document.getElementById(`${tab}-tab`).classList.add('active');
    });
  });
}

// Setup Forms
function setupForms() {
  document.getElementById('badge-form').addEventListener('submit', handleBadgeSubmit);
  document.getElementById('category-form').addEventListener('submit', handleCategorySubmit);
}

// Load Categories
async function loadCategories() {
  try {
    const response = await fetch('/api/categories');
    categories = await response.json();
    renderCategories();
    updateCategorySelect();
  } catch (error) {
    showToast('Failed to load categories', 'error');
  }
}

// Render Categories
function renderCategories() {
  const container = document.getElementById('categories-list');
  
  if (categories.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No categories yet. Create one to get started!</p>';
    return;
  }
  
  container.innerHTML = categories.map(cat => `
    <div class="category-card">
      <div style="display: flex; align-items: center; flex: 1;">
        <span class="category-emoji">${cat.emoji || '🏆'}</span>
        <div class="category-info">
          <div class="category-name">${cat.name}</div>
          <div class="category-description">${cat.description || 'No description'}</div>
        </div>
      </div>
      <button class="btn-icon btn-delete" onclick="deleteCategory('${cat._id}')">Delete</button>
    </div>
  `).join('');
}

// Update Category Select
function updateCategorySelect() {
  const select = document.getElementById('badge-category');
  select.innerHTML = '<option value="">Select category</option>' +
    categories.map(cat => `<option value="${cat._id}">${cat.emoji || '🏆'} ${cat.name}</option>`).join('');
}

// Load Badges
async function loadBadges() {
  try {
    const response = await fetch('/api/badges');
    badges = await response.json();
    renderBadges();
  } catch (error) {
    showToast('Failed to load badges', 'error');
  }
}

// Render Badges
function renderBadges() {
  const container = document.getElementById('badges-grid');
  
  if (badges.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-muted); grid-column: 1/-1;">No badges yet. Create one to get started!</p>';
    return;
  }
  
  container.innerHTML = badges.map(badge => `
    <div class="badge-card" data-name="${badge.name.toLowerCase()}">
      <img src="/uploads/${badge.imageUrl.replace('badges/', '')}" alt="${badge.name}" class="badge-image">
      <h3>${badge.name}</h3>
      <div class="badge-category">${badge.category.emoji || '🏆'} ${badge.category.name}</div>
      <p class="badge-description">${badge.description}</p>
      <div class="badge-actions">
        <button class="btn-icon btn-edit" onclick="editBadge('${badge._id}')">Edit</button>
        <button class="btn-icon btn-delete" onclick="deleteBadge('${badge._id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// Filter Badges
function filterBadges() {
  const searchTerm = document.getElementById('badge-search').value.toLowerCase();
  const cards = document.querySelectorAll('.badge-card');
  
  cards.forEach(card => {
    const name = card.dataset.name;
    if (name.includes(searchTerm)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

// Badge Modal
function openBadgeModal() {
  editingBadgeId = null;
  document.getElementById('badge-modal-title').textContent = 'Create Badge';
  document.getElementById('badge-submit-text').textContent = 'Create Badge';
  document.getElementById('badge-form').reset();
  document.getElementById('badge-id').value = '';
  document.getElementById('image-preview').innerHTML = '';
  document.getElementById('badge-image').required = true;
  document.getElementById('badge-modal').classList.add('active');
}

function closeBadgeModal() {
  document.getElementById('badge-modal').classList.remove('active');
}

function editBadge(id) {
  const badge = badges.find(b => b._id === id);
  if (!badge) return;
  
  editingBadgeId = id;
  document.getElementById('badge-modal-title').textContent = 'Edit Badge';
  document.getElementById('badge-submit-text').textContent = 'Update Badge';
  document.getElementById('badge-id').value = id;
  document.getElementById('badge-name').value = badge.name;
  document.getElementById('badge-description').value = badge.description;
  document.getElementById('badge-category').value = badge.category._id;
  document.getElementById('badge-image').required = false;
  
  document.getElementById('image-preview').innerHTML = `
    <img src="/uploads/${badge.imageUrl.replace('badges/', '')}" alt="${badge.name}">
    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 10px;">Leave empty to keep current image</p>
  `;
  
  document.getElementById('badge-modal').classList.add('active');
}

async function handleBadgeSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData();
  formData.append('name', document.getElementById('badge-name').value);
  formData.append('description', document.getElementById('badge-description').value);
  formData.append('category', document.getElementById('badge-category').value);
  
  const imageFile = document.getElementById('badge-image').files[0];
  if (imageFile) {
    formData.append('image', imageFile);
  }
  
  try {
    const url = editingBadgeId ? `/api/badges/${editingBadgeId}` : '/api/badges';
    const method = editingBadgeId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    
    showToast(editingBadgeId ? 'Badge updated successfully!' : 'Badge created successfully!', 'success');
    closeBadgeModal();
    loadBadges();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteBadge(id) {
  if (!confirm('Are you sure you want to delete this badge? This will remove it from all users.')) return;
  
  try {
    const response = await fetch(`/api/badges/${id}`, { method: 'DELETE' });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    
    showToast('Badge deleted successfully!', 'success');
    loadBadges();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Category Modal
function openCategoryModal() {
  document.getElementById('category-form').reset();
  document.getElementById('category-modal').classList.add('active');
}

function closeCategoryModal() {
  document.getElementById('category-modal').classList.remove('active');
}

async function handleCategorySubmit(e) {
  e.preventDefault();
  
  const data = {
    name: document.getElementById('category-name').value,
    description: document.getElementById('category-description').value,
    emoji: document.getElementById('category-emoji').value || '🏆'
  };
  
  try {
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    
    showToast('Category created successfully!', 'success');
    closeCategoryModal();
    loadCategories();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this category?')) return;
  
  try {
    const response = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }
    
    showToast('Category deleted successfully!', 'success');
    loadCategories();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Image Preview
function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  document.getElementById('file-name').textContent = file.name;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('image-preview').innerHTML = `
      <img src="${e.target.result}" alt="Preview">
    `;
  };
  reader.readAsDataURL(file);
}

// Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Close modals on outside click
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

