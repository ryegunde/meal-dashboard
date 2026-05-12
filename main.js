// Phase 1 MVP - Main Logic
// Uses hardcoded data to test color simulation and read-only calendar view

const STATE = {
    foods: [],
    inventory: [],
    recipes: [],
    scheduledMeals: [],
    computedMeals: [],
    dashboardAlerts: [],
    currentWeekStart: null // Date object for Sunday of the active week
};
window.STATE = STATE;

const STORAGE_KEY = 'PREPFLOW_DATA_V1';

// 1. Core Logic & Data loading
async function initApp() {
    try {
        // 1. Load from localStorage or seedData
        const saved = localStorage.getItem(STORAGE_KEY);
        let data;
        
        if (saved) {
            data = JSON.parse(saved);
            console.log("Loaded data from localStorage");
        } else {
            const res = await fetch('seedData.json');
            data = await res.json();
            console.log("Loaded fallback seed data");
        }
        
        STATE.foods = data.foods || [];
        STATE.inventory = data.inventory || [];
        STATE.recipes = data.recipes || [];
        STATE.scheduledMeals = data.scheduledMeals || [];
        
        // 2. Initialize Calendar Date (Start of current week)
        const now = new Date();
        const day = now.getDay(); // 0 (Sun) to 6 (Sat)
        const sunday = new Date(now);
        sunday.setDate(now.getDate() - day);
        sunday.setHours(0, 0, 0, 0);
        STATE.currentWeekStart = sunday;

        // 3. Midnight Cleanup (Subtract past meals from inventory)
        processMidnightCleanup();

        runSimulation();
        renderView('calendar');
        setupEventListeners();
        setupNavigation();
        document.body.setAttribute('data-app-ready', 'true');
    } catch(err) {
        console.error("Failed to initialize app", err);
    }
}

function saveState() {
    const dataToSave = {
        foods: STATE.foods,
        inventory: STATE.inventory,
        recipes: STATE.recipes,
        scheduledMeals: STATE.scheduledMeals
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
}

// 1.5. Midnight Cleanup Logic
function processMidnightCleanup() {
    try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        let changed = false;

        console.log(`Checking midnight cleanup for: ${todayStr}`);

        STATE.scheduledMeals.forEach(meal => {
            // If meal is in the past and hasn't been consumed yet
            if (meal.date < todayStr && !meal.consumed) {
                const recipe = STATE.recipes.find(r => r.id === meal.recipeId);
                if (recipe) {
                    recipe.ingredients.forEach(req => {
                        const food = STATE.foods.find(f => f.id === req.foodId);
                        const inv = STATE.inventory.find(i => i.foodId === req.foodId);
                        if (food && inv && food.stages && food.stages.length > 0) {
                            // Subtract from the FINAL stage of the food pipeline
                            const finalStage = food.stages[food.stages.length - 1];
                            const finalStageId = finalStage.id;
                            const neededQuantity = req.quantityPerPortion * recipe.portions;
                            
                            if (inv.stageQuantities[finalStageId] !== undefined) {
                                const oldVal = inv.stageQuantities[finalStageId];
                                inv.stageQuantities[finalStageId] = Math.max(0, oldVal - neededQuantity);
                                changed = true;
                                console.log(`  - Subtracted ${neededQuantity} of ${food.name} (Stage: ${finalStage.name})`);
                            }
                        }
                    });
                }
                meal.consumed = true;
                changed = true;
                console.log(`  - Marked meal ${meal.id} (${meal.recipeId}) as consumed`);
            }
        });

        if (changed) {
            saveState();
            runSimulation();
            // If the current view is inventory or calendar, we might want to re-render
            const activeNav = document.querySelector('.nav-links li.active');
            if (activeNav) {
                renderView(activeNav.getAttribute('data-view'));
            }
        }
    } catch (err) {
        console.error("Critical error in processMidnightCleanup:", err);
    }
}
window.processMidnightCleanup = processMidnightCleanup;

// Check for midnight every minute
setInterval(processMidnightCleanup, 60000);

// 2. Simplistic Phase 1 Simulation (Non-time-aware)
// Goal: Check if total inventory across all stages >= required.
function runSimulation() {
    // Basic evaluation for MVP
    STATE.computedMeals = STATE.scheduledMeals.map(meal => {
        const recipe = STATE.recipes.find(r => r.id === meal.recipeId);
        if(!recipe) return { ...meal, status: 'Red', missing: [] };

        let mealStatus = 'Green';
        let allIngredients = [];

        for (const req of recipe.ingredients) {
            const food = STATE.foods.find(f => f.id === req.foodId);
            const inv = STATE.inventory.find(i => i.foodId === req.foodId);
            const neededQuantity = req.quantityPerPortion * recipe.portions;
            
            // Check total quantity across all stages
            let totalAvailable = 0;
            let finalStageAvailable = 0;
            
            if(inv) {
                const finalStageId = food.stages[food.stages.length - 1].id;
                finalStageAvailable = inv.stageQuantities[finalStageId] || 0;
                
                Object.values(inv.stageQuantities).forEach(qty => {
                    totalAvailable += qty;
                });
            }
            
            let status = 'success';
            if (totalAvailable < neededQuantity) {
                mealStatus = 'Red'; // Missing entirely
                status = 'error';
            } else if (finalStageAvailable < neededQuantity) {
                if (mealStatus !== 'Red') mealStatus = 'Blue';
                status = 'warning';
            }

            allIngredients.push({
                foodId: req.foodId,
                foodName: food ? food.name : req.foodId,
                needed: neededQuantity,
                have: totalAvailable,
                deficit: Math.max(0, neededQuantity - totalAvailable),
                status: status,
                needsPrep: status === 'warning'
            });
        }

        return {
            ...meal,
            recipeName: recipe.name,
            status: mealStatus,
            ingredients: allIngredients
        };
    });

    // Compute dashboard alerts after simulation
    computeDashboardAlerts();
}

// 2.5. Dashboard Alerts Computation
// Produces STATE.dashboardAlerts — sorted by urgency date.
function computeDashboardAlerts() {
    const todayStr = new Date().toISOString().split('T')[0];

    // Only non-consumed future (and today's) meals, sorted by date ascending
    const upcomingMeals = STATE.computedMeals
        .filter(m => !m.consumed && m.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date));

    // Accumulate: one entry per foodId (most urgent / worst-case)
    const alertMap = {}; // foodId -> alert object

    upcomingMeals.forEach(meal => {
        const mealDate = new Date(meal.date + 'T00:00:00'); // Local midnight

        meal.ingredients.forEach(req => {
            if (req.status === 'success') return; // All good

            const food = STATE.foods.find(f => f.id === req.foodId);
            if (!food) return;

            let alertType, nextStageName, actionDate;

            if (req.status === 'error') {
                // Red: ingredient missing entirely
                alertType = 'red';
                // Action needed immediately (or as soon as possible)
                // Use the earliest required prep stage deadline for action date
                const earliestStage = food.stages[0]; // highest daysBefore (sorted desc in data)
                const actionD = new Date(mealDate);
                actionD.setDate(mealDate.getDate() - (earliestStage ? earliestStage.daysBefore : 0));
                actionDate = actionD.toISOString().split('T')[0];
                nextStageName = earliestStage ? earliestStage.name : 'Acquire';
            } else {
                // Blue: needs prep — find which stage to action next
                alertType = 'blue';
                const inv = STATE.inventory.find(i => i.foodId === req.foodId);
                // Stages are stored sorted desc by daysBefore (start -> finish)
                // Walk stages to find the first one that lacks sufficient quantity
                let targetStage = null;
                for (const stage of food.stages) {
                    const qty = inv ? (inv.stageQuantities[stage.id] || 0) : 0;
                    if (qty < req.needed) {
                        targetStage = stage;
                        break; // first deficient stage = what needs to be initiated
                    }
                }
                if (!targetStage) targetStage = food.stages[food.stages.length - 1];
                nextStageName = targetStage.name;
                const actionD = new Date(mealDate);
                actionD.setDate(mealDate.getDate() - targetStage.daysBefore);
                actionDate = actionD.toISOString().split('T')[0];
            }

            const existing = alertMap[req.foodId];
            // Keep the most urgent: red beats blue, earlier actionDate beats later
            const isMoreUrgent = !existing ||
                (alertType === 'red' && existing.alertType !== 'red') ||
                (alertType === existing.alertType && actionDate < existing.actionDate);

            if (isMoreUrgent) {
                alertMap[req.foodId] = {
                    foodId: req.foodId,
                    foodName: req.foodName,
                    alertType,
                    mealId:   meal.id,
                    mealDate: meal.date,
                    recipeName: meal.recipeName,
                    mealType: meal.type,
                    needed: req.needed,
                    have: req.have,
                    deficit: req.deficit,
                    nextStageName,
                    actionDate
                };
            }
        });
    });

    // Sort: red before blue on same date, then by actionDate asc
    STATE.dashboardAlerts = Object.values(alertMap).sort((a, b) => {
        if (a.actionDate !== b.actionDate) return a.actionDate.localeCompare(b.actionDate);
        if (a.alertType !== b.alertType) return a.alertType === 'red' ? -1 : 1;
        return a.foodName.localeCompare(b.foodName);
    });
}
window.computeDashboardAlerts = computeDashboardAlerts;

// 3. UI Rendering
function renderView(viewName) {
    const container = document.getElementById('view-container');
    container.innerHTML = '';
    document.getElementById('view-title').textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1) + ' Plan';

    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

    const calNav = document.getElementById('calendar-nav');
    if (calNav) {
        if (viewName === 'calendar') {
            calNav.classList.remove('hidden');
        } else {
            calNav.classList.add('hidden');
        }
    }

    if(viewName === 'calendar') {
        const tpl = document.getElementById('tpl-calendar').content.cloneNode(true);
        container.appendChild(tpl);
        renderCalendar();
    } else if (viewName === 'recipes') {
        const tpl = document.getElementById('tpl-recipes').content.cloneNode(true);
        container.appendChild(tpl);
        renderRecipes();
        setupRecipeBuilder();
    } else if (viewName === 'foods') {
        const tpl = document.getElementById('tpl-foods').content.cloneNode(true);
        container.appendChild(tpl);
        renderFoods();
        setupFoodBuilder();
    } else if (viewName === 'inventory') {
        const tpl = document.getElementById('tpl-inventory').content.cloneNode(true);
        container.appendChild(tpl);
        renderInventory();
    } else if (viewName === 'dashboard') {
        const tpl = document.getElementById('tpl-dashboard').content.cloneNode(true);
        container.appendChild(tpl);
        renderDashboard();
    } else {
        container.innerHTML = `<div style="color: var(--text-secondary); text-align: center; margin-top: 100px;">
            ${viewName} module is under construction (Phase 2).
        </div>`;
    }
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if(!grid) return;
    grid.innerHTML = '';

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mealTypes = ['breakfast', 'lunch', 'dinner'];

    // Update Header Date Range
    const weekEnd = new Date(STATE.currentWeekStart);
    weekEnd.setDate(STATE.currentWeekStart.getDate() + 6);
    
    const startStr = `${months[STATE.currentWeekStart.getMonth()]} ${STATE.currentWeekStart.getDate()}`;
    const endStr = `${months[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
    document.getElementById('header-date').textContent = `${startStr} - ${endStr}`;

    for(let i=0; i<7; i++) {
        const targetDate = new Date(STATE.currentWeekStart);
        targetDate.setDate(STATE.currentWeekStart.getDate() + i);
        
        const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const daySlot = document.createElement('div');
        daySlot.className = 'day-column';
        
        // Highlight "Today"
        const todayStr = new Date().toISOString().split('T')[0];
        if (dateStr === todayStr) daySlot.classList.add('is-today');

        let slotsHtml = '';
        mealTypes.forEach(type => {
            const meal = STATE.computedMeals.find(m => m.date === dateStr && m.type === type);
            if (meal) {
                slotsHtml += createMealCardHTML(meal, type.charAt(0).toUpperCase() + type.slice(1));
            } else {
                slotsHtml += `
                    <div class="add-meal-slot" data-date="${dateStr}" data-type="${type}">
                        <i class="ph ph-plus-circle"></i>
                        <span>${type}</span>
                    </div>
                `;
            }
        });
        
        daySlot.innerHTML = `
            <div class="day-header">
                <div class="day-name">${days[targetDate.getDay()]}</div>
                <div class="day-date">${targetDate.getDate()}</div>
            </div>
            <div class="meal-slots">
                ${slotsHtml}
            </div>
        `;
        grid.appendChild(daySlot);
    }
}

function createMealCardHTML(meal, typeLabel) {
    return `
        <div class="meal-card status-${meal.status}" data-meal-id="${meal.id}" data-date="${meal.date}" data-type="${meal.type.toLowerCase()}">
            <div class="meal-type">${typeLabel}</div>
            <div class="meal-name">${meal.recipeName}</div>
        </div>
    `;
}

// --- CALENDAR INTERACTION ---
let activePickerTarget = null; // { date, type }

function setupCalendarInteractions() {
    document.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.add-meal-slot');
        const mealCard = e.target.closest('.meal-card');
        
        if (addBtn) {
            activePickerTarget = { date: addBtn.dataset.date, type: addBtn.dataset.type };
            openMealPicker();
        } else if (mealCard) {
            // If clicking existing meal: 
            // Option 1: Open Debug (default)
            // Option 2: Allow Edit (we will add a button to the debug panel or handle long press?)
            // Let's modify debug panel to HAVE an edit/delete option.
            const mealId = mealCard.dataset.mealId;
            openDebugPanel(mealId);
        }
    });

    document.getElementById('close-meal-picker').addEventListener('click', () => {
        document.getElementById('meal-picker-modal').classList.add('hidden');
    });

    document.getElementById('btn-clear-meal').addEventListener('click', () => {
        if (!activePickerTarget || !activePickerTarget.mealId) return;
        deleteScheduledMeal(activePickerTarget.mealId);
        document.getElementById('meal-picker-modal').classList.add('hidden');
    });

    document.getElementById('recipe-picker-list').addEventListener('click', (e) => {
        const item = e.target.closest('.recipe-picker-item');
        if (!item) return;
        
        const recipeId = item.dataset.recipeId;
        saveScheduledMeal(recipeId);
        document.getElementById('meal-picker-modal').classList.add('hidden');
    });
}

function openMealPicker(mealId = null) {
    const modal = document.getElementById('meal-picker-modal');
    const list = document.getElementById('recipe-picker-list');
    const title = document.getElementById('meal-picker-title');
    const clearBtn = document.getElementById('btn-clear-meal');

    title.textContent = `Assign ${activePickerTarget.type.charAt(0).toUpperCase() + activePickerTarget.type.slice(1)} (${activePickerTarget.date})`;
    
    if (mealId) {
        activePickerTarget.mealId = mealId;
        clearBtn.classList.remove('hidden');
    } else {
        delete activePickerTarget.mealId;
        clearBtn.classList.add('hidden');
    }

    modal.classList.remove('hidden');

    // Search Logic
    const searchInput = document.getElementById('recipe-search-input');
    searchInput.value = '';
    searchInput.focus();

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = STATE.recipes.filter(r => 
            r.name.toLowerCase().includes(query) || 
            r.dishType.toLowerCase().includes(query)
        );
        renderPickerList(filtered);
    });

    renderPickerList(STATE.recipes);
}

function renderPickerList(recipes) {
    const list = document.getElementById('recipe-picker-list');
    let html = '';
    recipes.forEach(recipe => {
        html += `
            <div class="recipe-picker-item" data-recipe-id="${recipe.id}">
                <div>
                    <h4>${recipe.name}</h4>
                    <span>${recipe.dishType} • ${recipe.portions} portions</span>
                </div>
                <i class="ph ph-plus" style="opacity: 0.5;"></i>
            </div>
        `;
    });
    list.innerHTML = html || `<div style="text-align:center; padding: 20px; color: var(--text-secondary);">No recipes found matching your search.</div>`;
}

function saveScheduledMeal(recipeId) {
    if (!activePickerTarget) return;

    if (activePickerTarget.mealId) {
        // Update existing
        const meal = STATE.scheduledMeals.find(m => m.id === activePickerTarget.mealId);
        if (meal) meal.recipeId = recipeId;
    } else {
        // Create new
        const newMeal = {
            id: 'm_' + Date.now(),
            date: activePickerTarget.date,
            type: activePickerTarget.type,
            recipeId: recipeId
        };
        STATE.scheduledMeals.push(newMeal);
    }

    runSimulation();
    renderCalendar();
    saveState();
}

function deleteScheduledMeal(mealId) {
    STATE.scheduledMeals = STATE.scheduledMeals.filter(m => m.id !== mealId);
    runSimulation();
    renderCalendar();
    saveState();
}

function setupNavigation() {
    const prev = document.getElementById('prev-week');
    const next = document.getElementById('next-week');
    if(!prev || !next) return;

    prev.addEventListener('click', () => {
        STATE.currentWeekStart.setDate(STATE.currentWeekStart.getDate() - 7);
        renderCalendar();
    });

    next.addEventListener('click', () => {
        STATE.currentWeekStart.setDate(STATE.currentWeekStart.getDate() + 7);
        renderCalendar();
    });
}

// --- RECIPES MODULE ---

let editingRecipeId = null;

function renderRecipes() {
    const list = document.getElementById('recipe-list');
    if(!list) return;
    
    let html = '';
    STATE.recipes.forEach(recipe => {
        let ingredientsHTML = recipe.ingredients.map(req => {
            const food = STATE.foods.find(f => f.id === req.foodId);
            return `${req.quantityPerPortion}x ${food ? food.name : req.foodId}`;
        }).join(', ');
        
        html += `
            <div class="recipe-item" data-recipe-id="${recipe.id}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                    <h3 style="margin: 0;">${recipe.name}</h3>
                    <div style="display: flex; gap: 4px;">
                        <button class="icon-btn btn-edit-recipe"><i class="ph ph-pencil-simple"></i></button>
                        <button class="icon-btn btn-delete-recipe" style="color: var(--color-red);"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
                <div class="recipe-meta">${recipe.dishType} • ${recipe.portions} portion(s)</div>
                <div style="font-size:12px; color: var(--text-secondary); line-height: 1.4;">
                    ${ingredientsHTML}
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function setupRecipeBuilder() {
    document.getElementById('btn-add-recipe').addEventListener('click', () => {
        editingRecipeId = null;
        document.querySelector('#recipe-modal h2').textContent = 'Create Recipe';
        document.getElementById('recipe-name').value = '';
        document.getElementById('recipe-portions').value = 1;
        document.getElementById('recipe-dish-type').value = '';
        document.getElementById('ingredient-builder-list').innerHTML = '';
        addIngredientRow(); // Start with one empty row
        document.getElementById('recipe-modal').classList.remove('hidden');
    });

    document.getElementById('close-recipe-modal').addEventListener('click', () => {
        document.getElementById('recipe-modal').classList.add('hidden');
    });

    document.getElementById('btn-add-ingredient').addEventListener('click', () => addIngredientRow());
    document.getElementById('btn-save-recipe').addEventListener('click', saveRecipe);
    
    document.getElementById('recipe-list').addEventListener('click', (e) => {
        const btnEdit = e.target.closest('.btn-edit-recipe');
        const btnDelete = e.target.closest('.btn-delete-recipe');
        const card = e.target.closest('.recipe-item');
        if(!card) return;
        const recipeId = card.dataset.recipeId;
        
        if (btnEdit) openEditRecipeModal(recipeId);
        if (btnDelete) deleteRecipe(recipeId);
    });
}

function openEditRecipeModal(recipeId) {
    editingRecipeId = recipeId;
    const recipe = STATE.recipes.find(r => r.id === recipeId);
    if(!recipe) return;

    document.querySelector('#recipe-modal h2').textContent = 'Edit Recipe';
    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-portions').value = recipe.portions;
    document.getElementById('recipe-dish-type').value = recipe.dishType;
    document.getElementById('ingredient-builder-list').innerHTML = '';
    
    recipe.ingredients.forEach(ing => addIngredientRow(ing));
    
    document.getElementById('recipe-modal').classList.remove('hidden');
}

function deleteRecipe(recipeId) {
    if(!confirm('Delete this recipe? It will also be removed from the scheduled meals.')) return;
    
    STATE.recipes = STATE.recipes.filter(r => r.id !== recipeId);
    STATE.scheduledMeals = STATE.scheduledMeals.filter(m => m.recipeId !== recipeId);
    
    renderRecipes();
    runSimulation();
    saveState();
}

function addIngredientRow(ingredient = null) {
    const container = document.getElementById('ingredient-builder-list');
    
    const row = document.createElement('div');
    row.className = 'ingredient-builder-item';
    
    let options = '<option value="">Select Food...</option>';
    STATE.foods.forEach(f => {
        const isSelected = ingredient && ingredient.foodId === f.id ? 'selected' : '';
        options += `<option value="${f.id}" ${isSelected}>${f.name}</option>`;
    });

    row.innerHTML = `
        <select class="ingredient-select">${options}</select>
        <input type="number" class="ingredient-qty" min="1" step="any" placeholder="Qty" value="${ingredient ? ingredient.quantityPerPortion : ''}">
        <button class="btn-remove" title="Remove"><i class="ph ph-trash"></i></button>
    `;
    
    row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

function saveRecipe() {
    const name = document.getElementById('recipe-name').value.trim();
    const portions = parseFloat(document.getElementById('recipe-portions').value) || 1;
    const dishType = document.getElementById('recipe-dish-type').value.trim();
    
    if(!name) return alert('Recipe name is required');
    
    const ingredients = [];
    const rows = document.querySelectorAll('.ingredient-builder-item');
    rows.forEach(row => {
        const foodId = row.querySelector('.ingredient-select').value;
        const qty = parseFloat(row.querySelector('.ingredient-qty').value);
        if(foodId && qty && qty > 0) {
            ingredients.push({ foodId, quantityPerPortion: qty });
        }
    });
    
    if(ingredients.length === 0) return alert('At least one valid ingredient is required');

    if (editingRecipeId) {
        const recIndex = STATE.recipes.findIndex(r => r.id === editingRecipeId);
        if (recIndex > -1) {
            STATE.recipes[recIndex].name = name;
            STATE.recipes[recIndex].portions = portions;
            STATE.recipes[recIndex].dishType = dishType;
            STATE.recipes[recIndex].ingredients = ingredients;
        }
    } else {
        const newRecipe = {
            id: 'r_' + Date.now(),
            name,
            portions,
            dishType,
            ingredients
        };
        STATE.recipes.push(newRecipe);
    }
    
    document.getElementById('recipe-modal').classList.add('hidden');
    renderRecipes();
    runSimulation(); // Re-run simulation in case rules changed
    saveState();
}

// --- FOODS MODULE ---

function renderFoods() {
    const list = document.getElementById('food-list');
    if(!list) return;
    
    // Group foods by category
    const categories = {};
    STATE.foods.forEach(food => {
        const cat = food.category || 'Uncategorized';
        if(!categories[cat]) categories[cat] = [];
        categories[cat].push(food);
    });

    let html = '';
    const sortedCats = Object.keys(categories).sort();
    
    sortedCats.forEach(cat => {
        let foodsHTML = '';
        categories[cat].forEach(food => {
            let stagesHTML = food.stages.map(s => {
                let activeHtml = s.activeTimeMin ? `<span class="time-active" title="Active Time"><i class="ph ph-hand-fist"></i> ${s.activeTimeMin}m</span>` : '';
                let passiveHtml = s.passiveTimeMin ? `<span class="time-passive" title="Passive Time"><i class="ph ph-hourglass-low"></i> ${s.passiveTimeMin}m</span>` : '';
                return `<span class="food-stage-pill">${s.name} (${s.daysBefore}d)${activeHtml}${passiveHtml}</span>`;
            }).join('<span style="color:var(--text-secondary); font-size:10px; margin: 0 4px;">➔</span> ');
            
            foodsHTML += `
                <div class="recipe-item" data-food-id="${food.id}" style="border: 1px solid var(--border-color); padding: 16px; border-radius: 8px; margin-bottom: 12px; background: rgba(255,255,255,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                        <h3 style="margin: 0; font-size: 16px;">${food.name}</h3>
                        <div style="display: flex; gap: 4px;">
                            <button class="icon-btn btn-edit-food"><i class="ph ph-pencil-simple"></i></button>
                            <button class="icon-btn btn-delete-food" style="color: var(--color-red);"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                    <div style="margin-top: 12px; line-height: 1.8;">
                        ${stagesHTML}
                    </div>
                </div>
            `;
        });

        html += `
            <div class="inventory-accordion-item food-category-accordion" data-category="${cat}">
                <div class="inventory-accordion-header">
                    <span>${cat}</span>
                    <i class="ph ph-caret-down accordion-icon"></i>
                </div>
                <div class="inventory-accordion-content" style="padding: 16px;">
                    ${foodsHTML}
                </div>
            </div>
        `;
    });
    
    list.innerHTML = html;

    // Accordion toggle logic for food categories
    list.querySelectorAll('.inventory-accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const item = header.closest('.inventory-accordion-item');
            item.classList.toggle('open');
        });
    });
}

let editingFoodId = null;

function setupFoodBuilder() {
    document.getElementById('btn-add-food').addEventListener('click', () => {
        editingFoodId = null;
        document.querySelector('#food-modal h2').textContent = 'Define Food Pipeline';
        document.getElementById('food-name').value = '';
        document.getElementById('food-category').value = '';
        document.getElementById('stage-builder-list').innerHTML = '';
        addStageRow();
        document.getElementById('food-modal').classList.remove('hidden');
    });

    document.getElementById('close-food-modal').addEventListener('click', () => {
        document.getElementById('food-modal').classList.add('hidden');
    });

    document.getElementById('btn-add-stage').addEventListener('click', () => addStageRow());
    document.getElementById('btn-save-food').addEventListener('click', saveFood);

    document.getElementById('food-list').addEventListener('click', (e) => {
        const btnEdit = e.target.closest('.btn-edit-food');
        const btnDelete = e.target.closest('.btn-delete-food');
        const card = e.target.closest('.recipe-item');
        if(!card) return;
        const foodId = card.dataset.foodId;
        
        if (btnEdit) openEditFoodModal(foodId);
        if (btnDelete) deleteFood(foodId);
    });
}

function openEditFoodModal(foodId) {
    editingFoodId = foodId;
    const food = STATE.foods.find(f => f.id === foodId);
    if(!food) return;

    document.querySelector('#food-modal h2').textContent = 'Edit Food Pipeline';
    document.getElementById('food-name').value = food.name;
    document.getElementById('food-category').value = food.category || '';
    document.getElementById('food-portion-size').value = food.portionSize || '';
    document.getElementById('stage-builder-list').innerHTML = '';
    
    food.stages.forEach(stage => addStageRow(stage));
    
    document.getElementById('food-modal').classList.remove('hidden');
}

function deleteFood(foodId) {
    if(!confirm('Delete this food? It will be removed from all inventory and recipes.')) return;
    
    STATE.foods = STATE.foods.filter(f => f.id !== foodId);
    STATE.inventory = STATE.inventory.filter(i => i.foodId !== foodId);
    
    // Remove from recipes
    STATE.recipes.forEach(r => {
        r.ingredients = r.ingredients.filter(req => req.foodId !== foodId);
    });
    
    renderFoods();
    runSimulation();
    saveState();
}

function addStageRow(stage = null) {
    const container = document.getElementById('stage-builder-list');
    const row = document.createElement('div');
    row.className = 'stage-builder-item';
    
    if(stage) row.dataset.stageId = stage.id;
    
    row.innerHTML = `
        <input type="text" class="stage-name" placeholder="Stage Name (e.g. Frozen)" value="${stage ? stage.name : ''}">
        <input type="number" class="stage-days" min="0" placeholder="Days Before (e.g. 2)" title="Days before meal" value="${stage ? stage.daysBefore : ''}">
        <input type="number" class="stage-active" min="0" placeholder="Active Min" title="Active minutes" value="${stage ? (stage.activeTimeMin || '') : ''}">
        <input type="number" class="stage-passive" min="0" placeholder="Passive Min" title="Passive minutes" value="${stage ? (stage.passiveTimeMin || '') : ''}">
        <button class="btn-remove" title="Remove Stage"><i class="ph ph-trash"></i></button>
    `;
    
    row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

function saveFood() {
    const name = document.getElementById('food-name').value.trim();
    const category = document.getElementById('food-category').value.trim() || 'Uncategorized';
    const portionSize = parseFloat(document.getElementById('food-portion-size').value) || 0;
    if(!name) return alert('Food name is required');
    
    const stages = [];
    let hasError = false;
    
    const rows = document.querySelectorAll('.stage-builder-item');
    rows.forEach((row, index) => {
        const stageName = row.querySelector('.stage-name').value.trim();
        const days = parseInt(row.querySelector('.stage-days').value);
        const active = parseInt(row.querySelector('.stage-active').value) || 0;
        const passive = parseInt(row.querySelector('.stage-passive').value) || 0;
        
        if(!stageName || isNaN(days)) {
            hasError = true;
            return;
        }
        
        const stageId = row.dataset.stageId || ('s_' + Date.now() + '_' + index);
        
        stages.push({
            id: stageId,
            name: stageName,
            daysBefore: days,
            activeTimeMin: active,
            passiveTimeMin: passive
        });
    });
    
    if(hasError || stages.length === 0) return alert('Please provide at least one valid stage with a name and days before.');
    
    stages.sort((a, b) => b.daysBefore - a.daysBefore); // Sort Start -> Finish

    if (editingFoodId) {
        const foodIndex = STATE.foods.findIndex(f => f.id === editingFoodId);
        if (foodIndex > -1) {
            STATE.foods[foodIndex].name = name;
            STATE.foods[foodIndex].category = category;
            STATE.foods[foodIndex].portionSize = portionSize;
            STATE.foods[foodIndex].stages = stages;
            
            const inv = STATE.inventory.find(i => i.foodId === editingFoodId);
            if (inv) {
                const newQuants = {};
                stages.forEach(s => {
                    newQuants[s.id] = inv.stageQuantities[s.id] || 0;
                });
                inv.stageQuantities = newQuants;
            }
        }
    } else {
        const newFood = {
            id: 'f_' + Date.now(),
            name,
            category,
            portionSize,
            stages
        };
        STATE.foods.push(newFood);
        
        const stageQuants = {};
        stages.forEach(s => stageQuants[s.id] = 0);
        STATE.inventory.push({ foodId: newFood.id, stageQuantities: stageQuants });
    }

    document.getElementById('food-modal').classList.add('hidden');
    renderFoods();
    runSimulation();
    saveState();
}

// --- INVENTORY MODULE ---

function renderInventory() {
    const list = document.getElementById('inventory-list');
    if(!list) return;
    
    // Group foods by category
    const categories = {};
    STATE.foods.forEach(food => {
        const cat = food.category || 'Uncategorized';
        if(!categories[cat]) categories[cat] = [];
        categories[cat].push(food);
    });
    
    let html = '';
    const sortedCats = Object.keys(categories).sort();
    
    sortedCats.forEach(cat => {
        html += `<div class="inventory-category"><h3>${cat}</h3>`;
        
        categories[cat].forEach(food => {
            const invItem = STATE.inventory.find(i => i.foodId === food.id);
            if (!invItem) return;
            
            let totalQty = 0;
            let stagesHtml = '';
            food.stages.forEach(stage => {
                const qty = invItem.stageQuantities[stage.id] || 0;
                totalQty += qty;
                
                let portionInfoHtml = '';
                if (food.portionSize > 0) {
                    const portions = parseFloat((qty / food.portionSize).toFixed(2));
                    portionInfoHtml = `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="number" 
                                   class="inv-portion-input" 
                                   data-food-id="${food.id}" 
                                   data-stage-id="${stage.id}" 
                                   data-portion-size="${food.portionSize}"
                                   value="${portions}" 
                                   min="0" 
                                   step="any"
                                   placeholder="Portions"
                                   style="width: 80px; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.03); color: var(--color-accent); font-size: 13px; font-weight: 600; text-align: center;">
                            <span style="font-size: 11px; color: var(--text-secondary);">portions</span>
                        </div>
                    `;
                }

                stagesHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border-color);">
                        <div style="flex: 1;">
                            <span style="font-weight: 500; font-size: 14px;">${stage.name}</span>
                            <span style="font-size: 12px; color: var(--text-secondary); margin-left: 8px;">(${stage.daysBefore} days out)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 16px;">
                            ${portionInfoHtml}
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <input type="number" 
                                       class="inv-qty-input" 
                                       data-food-id="${food.id}" 
                                       data-stage-id="${stage.id}" 
                                       value="${qty}" 
                                       min="0" 
                                       step="any"
                                       style="width: 80px; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-primary); font-family: inherit;">
                                <span style="font-size: 12px; color: var(--text-secondary);">g</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            stagesHtml = stagesHtml.replace(/border-bottom: 1px solid var\(--border-color\);"\>[\s\S]*?(?=\<\/div\>\s*\<\/div\>$)/g, '">');
            
            html += `
                <div class="inventory-accordion-item" data-food-id="${food.id}">
                    <div class="inventory-accordion-header">
                        <div>
                            <span>${food.name}</span>
                            <span style="font-size: 12px; color: var(--text-secondary); margin-left: 12px;">Total: <span class="inv-total-sum">${totalQty}</span></span>
                        </div>
                        <i class="ph ph-caret-down accordion-icon"></i>
                    </div>
                    <div class="inventory-accordion-content">
                        ${stagesHtml}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    });
    
    list.innerHTML = html;
    
    // Accordion toggle logc
    list.querySelectorAll('.inventory-accordion-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if(e.target.tagName.toLowerCase() === 'input') return;
            const item = header.closest('.inventory-accordion-item');
            item.classList.toggle('open');
        });
    });
    
    // Attach event listeners for inputs
    list.querySelectorAll('.inv-qty-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const foodId = e.target.dataset.foodId;
            const stageId = e.target.dataset.stageId;
            const newQty = parseFloat(e.target.value) || 0;
            updateInventoryQuantity(foodId, stageId, newQty);
        });
    });

    list.querySelectorAll('.inv-portion-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const foodId = e.target.dataset.foodId;
            const stageId = e.target.dataset.stageId;
            const portionSize = parseFloat(e.target.dataset.portionSize);
            const numPortions = parseFloat(e.target.value) || 0;
            const newQty = numPortions * portionSize;
            updateInventoryQuantity(foodId, stageId, newQty);
        });
    });
}

function updateInventoryQuantity(foodId, stageId, newQty) {
    const inv = STATE.inventory.find(i => i.foodId === foodId);
    if(inv) {
        inv.stageQuantities[stageId] = newQty;
        runSimulation();
        saveState();
        
        // Live update the Total sum in the accordion header
        let newTotal = 0;
        Object.values(inv.stageQuantities).forEach(q => newTotal += q);
        const itemNode = document.querySelector(`.inventory-accordion-item[data-food-id="${foodId}"]`);
        if(itemNode) {
            const totalSpan = itemNode.querySelector('.inv-total-sum');
            if(totalSpan) totalSpan.textContent = newTotal % 1 === 0 ? newTotal : newTotal.toFixed(1);

            // Sync other inputs for this stage
            const stageInputs = itemNode.querySelectorAll(`[data-stage-id="${stageId}"]`);
            stageInputs.forEach(input => {
                if(input.classList.contains('inv-qty-input')) {
                    input.value = newQty;
                } else if(input.classList.contains('inv-portion-input')) {
                    const portionSize = parseFloat(input.dataset.portionSize);
                    input.value = parseFloat((newQty / portionSize).toFixed(2));
                }
            });
        }
    }
}


// 4. Debug Panel & Interactions
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.addEventListener('click', (e) => {
            const view = e.currentTarget.getAttribute('data-view');
            renderView(view);
            closeDebugPanel();
        });
    });

    setupCalendarInteractions();

    document.getElementById('close-panel').addEventListener('click', closeDebugPanel);
}

function openDebugPanel(mealId) {
    const meal = STATE.computedMeals.find(m => m.id === mealId);
    if(!meal) return;

    const panel = document.getElementById('debug-panel');
    const content = document.getElementById('debug-content');
    
    let html = `
        <h3 style="margin-bottom: 8px;">${meal.recipeName}</h3>
        <div style="opacity:0.5; font-size:14px; margin-bottom: 24px;">${meal.date} • ${meal.type.charAt(0).toUpperCase() + meal.type.slice(1)}</div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 32px;">
            <button class="btn btn-ghost" onclick="app_editMeal('${meal.id}', '${meal.date}', '${meal.type}')" style="flex: 1; font-size: 12px; padding: 6px;"><i class="ph ph-pencil"></i> Change</button>
            <button class="btn btn-ghost" onclick="app_deleteMeal('${meal.id}')" style="flex: 1; font-size: 12px; padding: 6px; color: var(--color-red); border-color: rgba(248, 113, 113, 0.2);"><i class="ph ph-trash"></i> Delete</button>
        </div>
    `;

    html += `<div class="ingredient-list">`;
    meal.ingredients.forEach(req => {
        html += `
            <div class="ingredient-req">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h4 style="margin: 0;">${req.foodName}</h4>
                    <span class="status-badge status-${req.status}" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05);">${req.status === 'success' ? 'Ready' : (req.status === 'error' ? 'Deficit' : 'Prep Needed')}</span>
                </div>
                <div class="req-stats">
                    <div class="req-stat ${req.status}" onclick="app_jumpToInventory('${req.foodId}')" style="cursor: pointer; text-decoration: underline;" title="Click to view in Inventory">Have: ${req.have}</div>
                    <div class="req-stat">Need: ${req.needed}</div>
                    ${req.deficit > 0 ? `<div class="req-stat error">Deficit: -${req.deficit}</div>` : ''}
                </div>
            </div>
        `;
    });
    html += `</div>`;

    content.innerHTML = html;
    panel.classList.add('open');
}

function closeDebugPanel() {
    document.getElementById('debug-panel').classList.remove('open');
}

// Global action helpers for inline onclicks
window.app_editMeal = (mealId, date, type) => {
    activePickerTarget = { date, type };
    openMealPicker(mealId);
    closeDebugPanel();
};
window.app_deleteMeal = (mealId) => {
    if(confirm('Remove this meal from schedule?')) {
        deleteScheduledMeal(mealId);
        closeDebugPanel();
    }
};

window.app_jumpToInventory = (foodId) => {
    renderView('inventory');
    const item = document.querySelector(`.inventory-accordion-item[data-food-id="${foodId}"]`);
    if (item) {
        item.classList.add('open');
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Brief highlight effect
        item.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        setTimeout(() => {
            item.style.backgroundColor = '';
        }, 1000);
    }
    closeDebugPanel();
};

// --- DASHBOARD MODULE ---

function renderDashboard() {
    const summaryEl = document.getElementById('dashboard-summary');
    const listEl    = document.getElementById('alert-list');
    if (!listEl) return;

    const alerts = STATE.dashboardAlerts || [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Summary strip
    const redCount  = alerts.filter(a => a.alertType === 'red').length;
    const blueCount = alerts.filter(a => a.alertType === 'blue').length;

    if (summaryEl) {
        if (alerts.length === 0) {
            summaryEl.innerHTML = `
                <span class="summary-pill summary-pill-green">
                    <i class="ph ph-check-circle"></i> All meals covered
                </span>`;
        } else {
            let pills = '';
            if (redCount)  pills += `<span class="summary-pill summary-pill-red"><i class="ph ph-warning-circle"></i> ${redCount} missing</span>`;
            if (blueCount) pills += `<span class="summary-pill summary-pill-blue"><i class="ph ph-clock-countdown"></i> ${blueCount} need prep</span>`;
            summaryEl.innerHTML = pills;
        }
    }

    // Alert cards or empty state
    if (alerts.length === 0) {
        listEl.innerHTML = `
            <div class="alert-empty-state" id="alert-empty-state">
                <i class="ph ph-check-fat"></i>
                <h2>You're all set!</h2>
                <p>No missing ingredients or pending prep steps for your upcoming meals.</p>
            </div>`;
        return;
    }

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function fmtDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        const diff = Math.round((d - new Date(todayStr + 'T00:00:00')) / 86400000);
        let label = '';
        if (diff === 0) label = ' (Today)';
        else if (diff === 1) label = ' (Tomorrow)';
        else if (diff > 0) label = ` (in ${diff}d)`;
        else label = ` (${Math.abs(diff)}d ago)`;
        return `${months[d.getMonth()]} ${d.getDate()}${label}`;
    }

    let html = '';
    alerts.forEach(alert => {
        const isRed  = alert.alertType === 'red';
        const isDue  = alert.actionDate <= todayStr;
        const actionLabel = isRed
            ? `<strong>Acquire ${alert.deficit.toFixed ? alert.deficit.toFixed(0) : alert.deficit} more</strong> (have ${alert.have}, need ${alert.needed})`
            : `<strong>Start: ${alert.nextStageName}</strong>`;
        const urgencyClass = isDue ? 'alert-urgency-chip alert-urgency-now' : 'alert-urgency-chip';

        html += `
            <div class="alert-card alert-${alert.alertType}" data-food-id="${alert.foodId}" data-alert-type="${alert.alertType}">
                <div class="alert-card-left">
                    <div class="alert-card-header">
                        <span class="alert-type-badge alert-badge-${alert.alertType}">
                            <i class="ph ${isRed ? 'ph-warning-circle' : 'ph-clock-countdown'}"></i>
                            ${isRed ? 'Missing' : 'Prep Needed'}
                        </span>
                        <span class="${urgencyClass}">
                            Act by: ${fmtDate(alert.actionDate)}
                        </span>
                    </div>
                    <div class="alert-food-name">${alert.foodName}</div>
                    <div class="alert-action-text">${actionLabel}</div>
                    <div class="alert-meal-ref">
                        <i class="ph ph-fork-knife"></i>
                        ${alert.recipeName} &bull; ${alert.mealType.charAt(0).toUpperCase() + alert.mealType.slice(1)} on ${fmtDate(alert.mealDate)}
                    </div>
                </div>
                <div class="alert-card-right">
                    <button class="btn btn-ghost alert-jump-btn"
                        onclick="app_jumpToInventory('${alert.foodId}')">
                        <i class="ph ph-arrow-square-out"></i> Inventory
                    </button>
                </div>
            </div>`;
    });

    listEl.innerHTML = html;
}
window.renderDashboard = renderDashboard;

// App Entry
window.addEventListener('DOMContentLoaded', initApp);
window.renderCalendar = renderCalendar;
window.renderView = renderView;
window.runSimulation = runSimulation;
