// Phase 1 MVP - Main Logic
// Uses hardcoded data to test color simulation and read-only calendar view

const STATE = {
    foods: [],
    inventory: [],
    recipes: [],
    scheduledMeals: [],
    computedMeals: []
};

// 1. Core Logic & Data loading
async function initApp() {
    try {
        const res = await fetch('seedData.json');
        const data = await res.json();
        
        STATE.foods = data.foods;
        STATE.inventory = data.inventory;
        STATE.recipes = data.recipes;
        STATE.scheduledMeals = data.scheduledMeals;
        
        runSimulation();
        renderView('calendar');
        setupEventListeners();
    } catch(err) {
        console.error("Failed to load initial data", err);
    }
}

// 2. Simplistic Phase 1 Simulation (Non-time-aware)
// Goal: Check if total inventory across all stages >= required.
function runSimulation() {
    // Basic evaluation for MVP
    STATE.computedMeals = STATE.scheduledMeals.map(meal => {
        const recipe = STATE.recipes.find(r => r.id === meal.recipeId);
        if(!recipe) return { ...meal, status: 'Red', missing: [] };

        let mealStatus = 'Green';
        let missingIngredients = [];

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
            
            if (totalAvailable < neededQuantity) {
                mealStatus = 'Red'; // Missing entirely
                missingIngredients.push({
                    foodName: food ? food.name : req.foodId,
                    needed: neededQuantity,
                    have: totalAvailable,
                    deficit: neededQuantity - totalAvailable
                });
            } else if (finalStageAvailable < neededQuantity && mealStatus !== 'Red') {
                mealStatus = 'Blue'; // Needs prep
                missingIngredients.push({
                    foodName: food ? food.name : req.foodId,
                    needed: neededQuantity,
                    haveInFinalStage: finalStageAvailable,
                    statusMsg: 'Needs prep (in earlier stages)'
                });
            }
        }

        return {
            ...meal,
            recipeName: recipe.name,
            status: mealStatus,
            missing: missingIngredients
        };
    });
}

// 3. UI Rendering
function renderView(viewName) {
    const container = document.getElementById('view-container');
    container.innerHTML = '';
    document.getElementById('view-title').textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1) + ' Plan';

    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

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

    // Generate upcoming 7 days starting from today (simulated as Mar 23)
    const baseDate = new Date('2026-03-23T12:00:00'); 
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const mealTypes = ['breakfast', 'lunch', 'dinner'];

    for(let i=0; i<7; i++) {
        const targetDate = new Date(baseDate);
        targetDate.setDate(baseDate.getDate() + i);
        
        const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const daySlot = document.createElement('div');
        daySlot.className = 'day-column';
        
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

    let html = '';
    STATE.recipes.forEach(recipe => {
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
    list.innerHTML = html;
    modal.classList.remove('hidden');
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
}

function deleteScheduledMeal(mealId) {
    STATE.scheduledMeals = STATE.scheduledMeals.filter(m => m.id !== mealId);
    runSimulation();
    renderCalendar();
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
}

// --- FOODS MODULE ---

function renderFoods() {
    const list = document.getElementById('food-list');
    if(!list) return;
    
    let html = '';
    STATE.foods.forEach(food => {
        let stagesHTML = food.stages.map(s => {
            let activeHtml = s.activeTimeMin ? `<span class="time-active" title="Active Time"><i class="ph ph-hand-fist"></i> ${s.activeTimeMin}m</span>` : '';
            let passiveHtml = s.passiveTimeMin ? `<span class="time-passive" title="Passive Time"><i class="ph ph-hourglass-low"></i> ${s.passiveTimeMin}m</span>` : '';
            return `<span class="food-stage-pill">${s.name} (${s.daysBefore}d)${activeHtml}${passiveHtml}</span>`;
        }).join('<span style="color:var(--text-secondary); font-size:10px; margin: 0 4px;">➔</span> ');
        
        html += `
            <div class="recipe-item" data-food-id="${food.id}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                    <h3 style="margin: 0;">${food.name}</h3>
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
    list.innerHTML = html;
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
                stagesHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border-color);">
                        <div>
                            <span style="font-weight: 500; font-size: 14px;">${stage.name}</span>
                            <span style="font-size: 12px; color: var(--text-secondary); margin-left: 8px;">(${stage.daysBefore} days out)</span>
                        </div>
                        <div>
                            <input type="number" 
                                   class="inv-qty-input" 
                                   data-food-id="${food.id}" 
                                   data-stage-id="${stage.id}" 
                                   value="${qty}" 
                                   min="0" 
                                   step="any"
                                   style="width: 80px; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-inner); color: var(--text-primary); font-family: inherit;">
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
            
            const inv = STATE.inventory.find(i => i.foodId === foodId);
            if (inv) {
                inv.stageQuantities[stageId] = newQty;
                runSimulation();
                
                // Live update the Total sum in the accordion header
                let newTotal = 0;
                Object.values(inv.stageQuantities).forEach(q => newTotal += q);
                const itemNode = input.closest('.inventory-accordion-item');
                const totalSpan = itemNode.querySelector('.inv-total-sum');
                if(totalSpan) totalSpan.textContent = newTotal;
            }
        });
    });
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

    if(meal.status === 'Green') {
        html += `<div style="color: var(--color-green); font-weight: 500; font-size: 15px;"><i class="ph ph-check-circle" style="font-size: 20px; vertical-align: bottom;"></i> All ingredients are fully prepped!</div>`;
    } else {
        html += `<div class="ingredient-list">`;
        meal.missing.forEach(req => {
            let details = '';
            if(req.deficit > 0) {
                details = `
                    <div class="req-stat error">Have: ${req.have}</div>
                    <div class="req-stat">Need: ${req.needed}</div>
                    <div class="req-stat">Deficit: -${req.deficit}</div>
                `;
            } else {
                details = `
                    <div class="req-stat warning">Needs Prep</div>
                `;
            }
            html += `
                <div class="ingredient-req">
                    <h4>${req.foodName}</h4>
                    <div class="req-stats">
                        ${details}
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

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

// App Entry
window.addEventListener('DOMContentLoaded', initApp);
