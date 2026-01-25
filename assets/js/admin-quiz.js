// ============================================
// ADMIN QUIZ - ÉDITEUR DE BLOCS
// OP! Parents
// VERSION: 2.0 - avec auto-save et collecte des données
// ============================================

let currentQuizId = null;
let blocks = [];
let isDirty = false;
let eventsInitialized = false;

// Types de blocs disponibles
const BLOCK_TYPES = {
    'section-title': { icon: '📑', name: 'Titre section' },
    'narrative': { icon: '📖', name: 'Narratif' },
    'info-box': { icon: '📋', name: 'Encadré info' },
    'stat': { icon: '📊', name: 'Statistique' },
    'poll': { icon: '🗳️', name: 'Sondage' },
    'quiz': { icon: '❓', name: 'Quiz' },
    'focus': { icon: '🔍', name: 'Focus' },
    'table': { icon: '📈', name: 'Tableau' },
    'exercise': { icon: '✍️', name: 'Exercice' },
    'summary': { icon: '📝', name: 'Résumé' },
    'cta': { icon: '🎯', name: 'CTA' },
    'image': { icon: '🖼️', name: 'Image' }
};

// ============================================
// INITIALISATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (!session) {
            window.location.href = 'login.html';
        } else {
            loadQuizzesList();
            if (!eventsInitialized) {
                initEventListeners();
                eventsInitialized = true;
            }
        }
    });
});

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
    // Nouveau quiz
    document.getElementById('new-quiz-btn').addEventListener('click', () => {
        openEditor(null);
    });
    
    // Retour
    document.getElementById('btn-back').addEventListener('click', () => {
        if (isDirty) {
            if (confirm('Des modifications non enregistrées seront perdues. Continuer ?')) {
                closeEditor();
            }
        } else {
            closeEditor();
        }
    });
    
    // Sauvegarder
    document.getElementById('btn-save').addEventListener('click', saveQuiz);
    
    // Aperçu
    document.getElementById('btn-preview').addEventListener('click', previewQuiz);
    
    // Ajout de blocs (clic sur les boutons)
    document.querySelectorAll('.block-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            addBlock(type);
        });
    });
    
    // Drag & Drop des types de blocs
    document.querySelectorAll('.block-type-btn').forEach(btn => {
        btn.setAttribute('draggable', true);
        btn.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('block-type', btn.dataset.type);
        });
    });
    
    // Zone de drop (canvas)
    const canvas = document.getElementById('blocks-container');
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('block-type');
        if (type) {
            addBlock(type);
        }
    });
    
    // Auto-génération du slug
    document.getElementById('quiz-title').addEventListener('input', (e) => {
        const slugField = document.getElementById('quiz-slug');
        if (!currentQuizId || !slugField.value) {
            slugField.value = generateSlug(e.target.value);
        }
        markDirty();
        autoSave();
    });
    
    // Tous les champs de paramètres - avec auto-save
    document.querySelectorAll('.settings-sidebar input, .settings-sidebar select, .settings-sidebar textarea').forEach(el => {
        el.addEventListener('change', () => {
            markDirty();
            autoSave();
        });
        el.addEventListener('input', () => {
            markDirty();
            autoSave();
        });
    });
    
    // Modal suppression
    document.getElementById('delete-cancel').addEventListener('click', () => {
        document.getElementById('delete-modal').classList.remove('active');
    });
    
    document.querySelector('#delete-modal .modal-overlay').addEventListener('click', () => {
        document.getElementById('delete-modal').classList.remove('active');
    });
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    });
}

// ============================================
// GESTION DES QUIZ (LISTE)
// ============================================

async function loadQuizzesList() {
    const tbody = document.getElementById('quizzes-list');
    
    try {
        const { data: quizzes, error } = await supabaseClient
            .from('quizzes')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Stats - utiliser published OU is_published selon ce qui existe
        document.getElementById('total-quizzes').textContent = quizzes.length;
        document.getElementById('published-quizzes').textContent = quizzes.filter(q => q.published || q.is_published).length;
        
        // Calculer les vues totales
        let totalViews = 0;
        quizzes.forEach(q => {
            totalViews += q.view_count || 0;
        });
        document.getElementById('total-responses').textContent = totalViews;
        
        if (quizzes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 3rem;">
                        <div style="color: var(--text-secondary);">
                            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📝</div>
                            Aucun guide créé. Cliquez sur "Nouveau guide" pour commencer.
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = quizzes.map(quiz => {
            const blocksCount = quiz.blocks ? quiz.blocks.length : 0;
            const icon = quiz.icon || '📝';
            const isPublished = quiz.published || quiz.is_published;
            const title = quiz.titre || quiz.title || 'Sans titre';
            
            return `
                <tr>
                    <td>
                        <div class="quiz-title-cell">
                            <div class="quiz-icon">${icon}</div>
                            <div class="quiz-info">
                                <h4>${title}</h4>
                                <small>${quiz.slug || 'pas-de-slug'}</small>
                            </div>
                        </div>
                    </td>
                    <td>${blocksCount}</td>
                    <td>${quiz.view_count || 0}</td>
                    <td>
                        <span class="status-badge ${isPublished ? 'published' : 'draft'}">
                            ${isPublished ? 'Publié' : 'Brouillon'}
                        </span>
                    </td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn-icon" onclick="openEditor('${quiz.id}')" title="Modifier">✏️</button>
                            <button class="btn-icon" onclick="duplicateQuiz('${quiz.id}')" title="Dupliquer">📋</button>
                            <button class="btn-icon delete" onclick="confirmDeleteQuiz('${quiz.id}')" title="Supprimer">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erreur chargement quiz:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="error">Erreur de chargement</td></tr>`;
    }
}

// ============================================
// ÉDITEUR
// ============================================

async function openEditor(quizId) {
    currentQuizId = quizId;
    blocks = [];
    isDirty = false;
    
    // Reset le formulaire
    document.getElementById('quiz-title').value = '';
    document.getElementById('quiz-subtitle').value = '';
    document.getElementById('quiz-slug').value = '';
    document.getElementById('quiz-duration').value = '10 min';
    document.getElementById('quiz-icon').value = '💰';
    document.getElementById('quiz-published').checked = false;
    document.getElementById('quiz-collect-email').checked = false;
    document.getElementById('quiz-show-progress').checked = true;
    document.getElementById('quiz-category').value = 'budget';
    document.getElementById('quiz-image').value = '';
    
    // Vider le canvas
    document.getElementById('blocks-container').innerHTML = '';
    document.getElementById('canvas-empty').style.display = 'flex';
    
    // Titre
    document.getElementById('editor-title').textContent = quizId ? 'Modifier le guide' : 'Nouveau guide';
    
    // Charger les données si édition
    if (quizId) {
        await loadQuizData(quizId);
    }
    
    // Afficher l'éditeur
    document.getElementById('quiz-editor-modal').classList.add('active');
    updateSaveStatus();
}

async function loadQuizData(quizId) {
    try {
        const { data: quiz, error } = await supabaseClient
            .from('quizzes')
            .select('*')
            .eq('id', quizId)
            .single();
        
        if (error) throw error;
        
        // Remplir les champs (supporte les deux formats de colonnes)
        document.getElementById('quiz-title').value = quiz.titre || quiz.title || '';
        document.getElementById('quiz-subtitle').value = quiz.sous_titre || quiz.subtitle || '';
        document.getElementById('quiz-slug').value = quiz.slug || '';
        document.getElementById('quiz-duration').value = quiz.duree || quiz.duration || '10 min';
        document.getElementById('quiz-icon').value = quiz.icon || '💰';
        document.getElementById('quiz-published').checked = quiz.published || quiz.is_published || false;
        document.getElementById('quiz-collect-email').checked = quiz.collect_email || false;
        document.getElementById('quiz-show-progress').checked = quiz.show_progress !== false;
        document.getElementById('quiz-category').value = quiz.category || 'budget';
        document.getElementById('quiz-image').value = quiz.image_url || '';
        
        // Charger les blocs
        if (quiz.blocks && Array.isArray(quiz.blocks)) {
            blocks = quiz.blocks;
            renderAllBlocks();
        }
        
    } catch (error) {
        console.error('Erreur chargement quiz:', error);
        alert('Erreur lors du chargement du guide');
    }
}

function closeEditor() {
    // Annuler l'auto-save en cours
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = null;
    }
    lastSavedData = null;
    
    document.getElementById('quiz-editor-modal').classList.remove('active');
    currentQuizId = null;
    blocks = [];
    isDirty = false;
    loadQuizzesList();
}

// ============================================
// GESTION DES BLOCS
// ============================================

function addBlock(type, index = -1) {
    console.log('➕ addBlock appelé, type:', type);
    
    // IMPORTANT: Collecter les données actuelles AVANT de re-render
    collectAllBlocksData();
    
    const blockData = {
        id: generateBlockId(),
        type: type,
        data: getDefaultBlockData(type)
    };
    
    if (index === -1) {
        blocks.push(blockData);
    } else {
        blocks.splice(index, 0, blockData);
    }
    
    console.log('📦 Blocs après ajout:', blocks.length);
    
    renderAllBlocks();
    markDirty();
    autoSave();
    
    // Scroll vers le nouveau bloc
    setTimeout(() => {
        const newBlock = document.querySelector(`[data-block-id="${blockData.id}"]`);
        if (newBlock) {
            newBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
            newBlock.classList.add('selected');
            setTimeout(() => newBlock.classList.remove('selected'), 1500);
        }
    }, 100);
}

function getDefaultBlockData(type) {
    switch (type) {
        case 'poll':
        case 'quiz':
            return {
                title: '',
                question: '',
                options: [
                    { text: '', correct: false },
                    { text: '', correct: false },
                    { text: '', correct: false }
                ],
                explanation: ''
            };
        case 'table':
            return {
                title: '',
                data: ''
            };
        case 'exercise':
            return {
                title: '',
                fields: '',
                instructions: ''
            };
        default:
            return {};
    }
}

function renderAllBlocks() {
    const container = document.getElementById('blocks-container');
    const emptyState = document.getElementById('canvas-empty');
    
    if (blocks.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    
    container.innerHTML = blocks.map((block, index) => {
        return renderBlock(block, index);
    }).join('');
    
    // Attacher les événements aux blocs
    attachBlockEvents();
}

function renderBlock(block, index) {
    const template = document.getElementById(`template-${block.type}`);
    if (!template) {
        console.warn(`Template non trouvé pour le type: ${block.type}`);
        return '';
    }
    
    const clone = template.content.cloneNode(true);
    const blockEl = clone.querySelector('.block-item');
    blockEl.dataset.blockId = block.id;
    blockEl.dataset.index = index;
    
    // Remplir les champs avec les données
    blockEl.querySelectorAll('.block-field').forEach(field => {
        const fieldName = field.dataset.field;
        if (block.data && block.data[fieldName] !== undefined) {
            field.value = block.data[fieldName];
        }
    });
    
    // Gérer les options pour quiz/poll
    if (block.type === 'quiz' || block.type === 'poll') {
        const optionsList = blockEl.querySelector('.options-list');
        if (block.data && block.data.options && Array.isArray(block.data.options)) {
            optionsList.innerHTML = block.data.options.map((opt, i) => {
                const letter = String.fromCharCode(65 + i); // A, B, C...
                const isCorrect = opt.correct ? 'correct' : '';
                const marker = block.type === 'poll' ? '□' : letter;
                
                return `
                    <div class="option-item ${isCorrect}">
                        <span class="option-marker">${marker}</span>
                        <input type="text" value="${opt.text || ''}" placeholder="Option ${i + 1}">
                        ${block.type === 'quiz' ? `<button class="option-correct-toggle" title="Bonne réponse">✓</button>` : ''}
                        <button class="option-delete" title="Supprimer">×</button>
                    </div>
                `;
            }).join('');
        }
    }
    
    // Convertir en string HTML
    const wrapper = document.createElement('div');
    wrapper.appendChild(clone);
    return wrapper.innerHTML;
}

function attachBlockEvents() {
    const container = document.getElementById('blocks-container');
    
    // Suppression de bloc
    container.querySelectorAll('.block-action-btn.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const blockEl = e.target.closest('.block-item');
            const blockId = blockEl.dataset.blockId;
            deleteBlock(blockId);
        });
    });
    
    // Duplication de bloc
    container.querySelectorAll('.block-action-btn.duplicate').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const blockEl = e.target.closest('.block-item');
            const blockId = blockEl.dataset.blockId;
            duplicateBlock(blockId);
        });
    });
    
    // Modification des champs
    container.querySelectorAll('.block-field').forEach(field => {
        field.addEventListener('input', (e) => {
            const blockEl = e.target.closest('.block-item');
            const blockId = blockEl.dataset.blockId;
            const fieldName = e.target.dataset.field;
            updateBlockData(blockId, fieldName, e.target.value);
            autoSave(); // Déclencher l'auto-save
        });
    });
    
    // Options quiz/poll - modification texte
    container.querySelectorAll('.options-list input[type="text"]').forEach(input => {
        input.addEventListener('input', (e) => {
            const blockEl = e.target.closest('.block-item');
            const blockId = blockEl.dataset.blockId;
            updateBlockOptions(blockId);
            autoSave(); // Déclencher l'auto-save
        });
    });
    
    // Options quiz - toggle correct
    container.querySelectorAll('.option-correct-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const optionItem = e.target.closest('.option-item');
            const blockEl = e.target.closest('.block-item');
            const blockId = blockEl.dataset.blockId;
            
            // Toggle la classe
            const wasCorrect = optionItem.classList.contains('correct');
            
            // Enlever correct de toutes les options
            blockEl.querySelectorAll('.option-item').forEach(item => {
                item.classList.remove('correct');
            });
            
            // Toggle sur celle cliquée
            if (!wasCorrect) {
                optionItem.classList.add('correct');
            }
            
            updateBlockOptions(blockId);
            autoSave(); // Déclencher l'auto-save
        });
    });
    
    // Options - suppression
    container.querySelectorAll('.option-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const optionItem = e.target.closest('.option-item');
            const blockEl = e.target.closest('.block-item');
            const blockId = blockEl.dataset.blockId;
            
            optionItem.remove();
            updateBlockOptions(blockId);
            
            // Mettre à jour les markers
            updateOptionMarkers(blockEl);
            autoSave(); // Déclencher l'auto-save
        });
    });
    
    // Options - ajout
    container.querySelectorAll('.add-option-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const blockEl = e.target.closest('.block-item');
            const blockId = blockEl.dataset.blockId;
            const optionsList = blockEl.querySelector('.options-list');
            const blockType = blockEl.dataset.type;
            const count = optionsList.querySelectorAll('.option-item').length;
            const letter = String.fromCharCode(65 + count);
            const marker = blockType === 'poll' ? '□' : letter;
            
            const newOption = document.createElement('div');
            newOption.className = 'option-item';
            newOption.innerHTML = `
                <span class="option-marker">${marker}</span>
                <input type="text" placeholder="Option ${count + 1}">
                ${blockType === 'quiz' ? `<button class="option-correct-toggle" title="Bonne réponse">✓</button>` : ''}
                <button class="option-delete" title="Supprimer">×</button>
            `;
            
            optionsList.appendChild(newOption);
            
            // Attacher les événements au nouvel élément
            newOption.querySelector('input').addEventListener('input', () => {
                updateBlockOptions(blockId);
                autoSave();
            });
            
            if (blockType === 'quiz') {
                newOption.querySelector('.option-correct-toggle').addEventListener('click', (e) => {
                    const wasCorrect = newOption.classList.contains('correct');
                    blockEl.querySelectorAll('.option-item').forEach(item => item.classList.remove('correct'));
                    if (!wasCorrect) newOption.classList.add('correct');
                    updateBlockOptions(blockId);
                    autoSave();
                });
            }
            
            newOption.querySelector('.option-delete').addEventListener('click', () => {
                newOption.remove();
                updateBlockOptions(blockId);
                updateOptionMarkers(blockEl);
                autoSave();
            });
            
            updateBlockOptions(blockId);
            markDirty();
            autoSave();
        });
    });
    
    // Drag & drop des blocs
    makeSortable(container);
}

function updateOptionMarkers(blockEl) {
    const blockType = blockEl.dataset.type;
    blockEl.querySelectorAll('.option-item').forEach((item, i) => {
        const marker = item.querySelector('.option-marker');
        if (blockType === 'poll') {
            marker.textContent = '□';
        } else {
            marker.textContent = String.fromCharCode(65 + i);
        }
    });
}

function updateBlockData(blockId, fieldName, value) {
    const block = blocks.find(b => b.id === blockId);
    if (block) {
        if (!block.data) block.data = {};
        block.data[fieldName] = value;
        markDirty();
    }
}

function updateBlockOptions(blockId) {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
    const optionItems = blockEl.querySelectorAll('.option-item');
    
    block.data.options = Array.from(optionItems).map(item => ({
        text: item.querySelector('input[type="text"]').value,
        correct: item.classList.contains('correct')
    }));
    
    markDirty();
}

function deleteBlock(blockId) {
    if (confirm('Supprimer ce bloc ?')) {
        // Collecter les données avant de supprimer
        collectAllBlocksData();
        blocks = blocks.filter(b => b.id !== blockId);
        renderAllBlocks();
        markDirty();
        autoSave();
    }
}

function duplicateBlock(blockId) {
    // Collecter les données avant de dupliquer
    collectAllBlocksData();
    
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const index = blocks.indexOf(block);
    const newBlock = {
        id: generateBlockId(),
        type: block.type,
        data: JSON.parse(JSON.stringify(block.data))
    };
    
    blocks.splice(index + 1, 0, newBlock);
    renderAllBlocks();
    markDirty();
    autoSave();
}

// ============================================
// DRAG & DROP POUR RÉORDONNER
// ============================================

function makeSortable(container) {
    let draggedItem = null;
    
    container.querySelectorAll('.block-item').forEach(item => {
        item.setAttribute('draggable', true);
        
        item.addEventListener('dragstart', (e) => {
            // Collecter les données avant de commencer le drag
            collectAllBlocksData();
            draggedItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedItem = null;
            
            // Mettre à jour l'ordre des blocs
            const newOrder = [];
            container.querySelectorAll('.block-item').forEach(el => {
                const blockId = el.dataset.blockId;
                const block = blocks.find(b => b.id === blockId);
                if (block) newOrder.push(block);
            });
            blocks = newOrder;
            markDirty();
            autoSave();
        });
        
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragging = container.querySelector('.dragging');
            if (dragging && item !== dragging) {
                const rect = item.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    container.insertBefore(dragging, item);
                } else {
                    container.insertBefore(dragging, item.nextSibling);
                }
            }
        });
    });
}

// ============================================
// SAUVEGARDE
// ============================================

async function saveQuiz() {
    const title = document.getElementById('quiz-title').value.trim();
    const slug = document.getElementById('quiz-slug').value.trim();
    
    if (!title) {
        alert('Le titre est obligatoire');
        return;
    }
    
    if (!slug) {
        alert('Le slug est obligatoire');
        return;
    }
    
    // Collecter toutes les données des blocs depuis le DOM
    collectAllBlocksData();
    
    // Utiliser les noms de colonnes existants (français)
    const quizData = {
        titre: title,
        sous_titre: document.getElementById('quiz-subtitle').value.trim(),
        slug: slug,
        duree: document.getElementById('quiz-duration').value.trim(),
        icon: document.getElementById('quiz-icon').value.trim() || '💰',
        published: document.getElementById('quiz-published').checked,
        collect_email: document.getElementById('quiz-collect-email').checked,
        show_progress: document.getElementById('quiz-show-progress').checked,
        category: document.getElementById('quiz-category').value,
        image_url: document.getElementById('quiz-image').value.trim(),
        blocks: blocks,
        updated_at: new Date().toISOString()
    };
    
    try {
        updateSaveStatus('saving');
        
        let result;
        if (currentQuizId) {
            // Mise à jour
            result = await supabaseClient
                .from('quizzes')
                .update(quizData)
                .eq('id', currentQuizId)
                .select()
                .single();
        } else {
            // Création
            quizData.created_at = new Date().toISOString();
            quizData.view_count = 0;
            result = await supabaseClient
                .from('quizzes')
                .insert(quizData)
                .select()
                .single();
            
            if (result.data) {
                currentQuizId = result.data.id;
            }
        }
        
        if (result.error) throw result.error;
        
        isDirty = false;
        updateSaveStatus('saved');
        
    } catch (error) {
        console.error('Erreur sauvegarde:', error);
        updateSaveStatus('error');
        alert('Erreur lors de la sauvegarde: ' + error.message);
    }
}

function collectAllBlocksData() {
    const container = document.getElementById('blocks-container');
    console.log('🔄 collectAllBlocksData - Nombre de blocs:', blocks.length);
    
    container.querySelectorAll('.block-item').forEach(blockEl => {
        const blockId = blockEl.dataset.blockId;
        const block = blocks.find(b => b.id === blockId);
        
        if (block) {
            // Collecter tous les champs
            blockEl.querySelectorAll('.block-field').forEach(field => {
                const fieldName = field.dataset.field;
                if (!block.data) block.data = {};
                block.data[fieldName] = field.value;
                console.log(`  📝 Block ${blockId}: ${fieldName} = "${field.value.substring(0, 30)}..."`);
            });
            
            // Collecter les options si quiz/poll
            if (block.type === 'quiz' || block.type === 'poll') {
                const optionItems = blockEl.querySelectorAll('.option-item');
                block.data.options = Array.from(optionItems).map(item => ({
                    text: item.querySelector('input[type="text"]').value,
                    correct: item.classList.contains('correct')
                }));
            }
        }
    });
    
    console.log('✅ Données collectées:', JSON.stringify(blocks.map(b => ({id: b.id, type: b.type, data: b.data})), null, 2));
}

// ============================================
// AUTO-SAVE (sauvegarde en temps réel)
// ============================================

let autoSaveTimeout = null;
let lastSavedData = null;

function autoSave() {
    // Annuler le timeout précédent
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }
    
    // Sauvegarder après 2 secondes d'inactivité
    autoSaveTimeout = setTimeout(async () => {
        // Vérifier qu'on a un quiz en cours d'édition avec un titre et slug
        const title = document.getElementById('quiz-title').value.trim();
        const slug = document.getElementById('quiz-slug').value.trim();
        
        if (!title || !slug) {
            // Pas assez d'infos pour sauvegarder
            return;
        }
        
        // Collecter les données actuelles
        collectAllBlocksData();
        
        // Vérifier si les données ont changé
        const currentData = JSON.stringify({ blocks, title, slug });
        if (currentData === lastSavedData) {
            return; // Rien n'a changé
        }
        
        // Sauvegarder
        try {
            updateSaveStatus('saving');
            
            const quizData = {
                titre: title,
                sous_titre: document.getElementById('quiz-subtitle').value.trim(),
                slug: slug,
                duree: document.getElementById('quiz-duration').value.trim(),
                icon: document.getElementById('quiz-icon').value.trim() || '💰',
                published: document.getElementById('quiz-published').checked,
                collect_email: document.getElementById('quiz-collect-email').checked,
                show_progress: document.getElementById('quiz-show-progress').checked,
                category: document.getElementById('quiz-category').value,
                image_url: document.getElementById('quiz-image').value.trim(),
                blocks: blocks,
                updated_at: new Date().toISOString()
            };
            
            let result;
            if (currentQuizId) {
                result = await supabaseClient
                    .from('quizzes')
                    .update(quizData)
                    .eq('id', currentQuizId)
                    .select()
                    .single();
            } else {
                quizData.created_at = new Date().toISOString();
                quizData.view_count = 0;
                result = await supabaseClient
                    .from('quizzes')
                    .insert(quizData)
                    .select()
                    .single();
                
                if (result.data) {
                    currentQuizId = result.data.id;
                }
            }
            
            if (result.error) throw result.error;
            
            lastSavedData = currentData;
            isDirty = false;
            updateSaveStatus('saved');
            
        } catch (error) {
            console.error('Erreur auto-save:', error);
            updateSaveStatus('error');
        }
    }, 2000);
}

// ============================================
// SUPPRESSION & DUPLICATION QUIZ
// ============================================

let quizToDelete = null;

function confirmDeleteQuiz(quizId) {
    quizToDelete = quizId;
    document.getElementById('delete-modal').classList.add('active');
    
    document.getElementById('delete-confirm').onclick = async () => {
        try {
            const { error } = await supabaseClient
                .from('quizzes')
                .delete()
                .eq('id', quizToDelete);
            
            if (error) throw error;
            
            document.getElementById('delete-modal').classList.remove('active');
            loadQuizzesList();
            
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
        }
    };
}

async function duplicateQuiz(quizId) {
    try {
        const { data: quiz, error } = await supabaseClient
            .from('quizzes')
            .select('*')
            .eq('id', quizId)
            .single();
        
        if (error) throw error;
        
        // Créer une copie avec les noms de colonnes français
        const titre = quiz.titre || quiz.title || 'Sans titre';
        const newQuiz = {
            ...quiz,
            id: undefined,
            titre: titre + ' (copie)',
            slug: quiz.slug + '-copie-' + Date.now(),
            published: false,
            view_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Supprimer les colonnes en doublon potentielles
        delete newQuiz.title;
        delete newQuiz.is_published;
        
        const { error: insertError } = await supabaseClient
            .from('quizzes')
            .insert(newQuiz);
        
        if (insertError) throw insertError;
        
        loadQuizzesList();
        
    } catch (error) {
        console.error('Erreur duplication:', error);
        alert('Erreur lors de la duplication');
    }
}

// ============================================
// APERÇU
// ============================================

function previewQuiz() {
    const slug = document.getElementById('quiz-slug').value.trim();
    if (!slug) {
        alert('Veuillez d\'abord définir un slug');
        return;
    }
    
    // Sauvegarder d'abord si des modifications
    if (isDirty) {
        if (confirm('Sauvegarder les modifications avant l\'aperçu ?')) {
            saveQuiz().then(() => {
                window.open(`../guide.html?slug=${slug}`, '_blank');
            });
        }
    } else {
        window.open(`../guide.html?slug=${slug}`, '_blank');
    }
}

// ============================================
// UTILITAIRES
// ============================================

function generateBlockId() {
    return 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateSlug(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 50);
}

function markDirty() {
    isDirty = true;
    updateSaveStatus('dirty');
}

function updateSaveStatus(status) {
    const statusEl = document.getElementById('save-status');
    
    switch (status) {
        case 'saving':
            statusEl.textContent = '💾 Enregistrement...';
            statusEl.style.color = 'var(--text-secondary)';
            break;
        case 'saved':
            statusEl.textContent = '✅ Enregistré';
            statusEl.style.color = 'var(--vert-fonce)';
            setTimeout(() => {
                if (!isDirty) statusEl.textContent = '';
            }, 2000);
            break;
        case 'dirty':
            statusEl.textContent = '● Modifications non enregistrées';
            statusEl.style.color = 'var(--terracotta)';
            break;
        case 'error':
            statusEl.textContent = '❌ Erreur';
            statusEl.style.color = 'var(--terracotta)';
            break;
        default:
            statusEl.textContent = '';
    }
}

// Prévenir la fermeture accidentelle
window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});