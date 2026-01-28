// ============================================
// ADMIN QUIZ - ÉDITEUR DE BLOCS
// OP! Parents
// VERSION: 4.0 - Ajout des séquences/niveaux
// ============================================

let currentQuizId = null;
let blocks = [];
let sequences = []; // NOUVEAU: Liste des séquences/niveaux
let activeSequenceIndex = 0; // NOUVEAU: Index de la séquence active
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
    'exercise': { icon: '✍️', name: 'Exercice calcul' },
    'exercise-text': { icon: '💬', name: 'Exercice texte' },
    'summary': { icon: '📝', name: 'Résumé' },
    'cta': { icon: '🎯', name: 'CTA' },
    'image': { icon: '🖼️', name: 'Image' },
    'personal-field': { icon: '👤', name: 'Champ perso' },
    'page-break': { icon: '➡️', name: 'Slide suivante' }
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
    
    // ============================================
    // UPLOAD IMAGE
    // ============================================
    
    const uploadZone = document.getElementById('image-upload-zone');
    const imageFileInput = document.getElementById('quiz-image-file');
    
    // Clic sur la zone d'upload
    uploadZone.addEventListener('click', () => {
        imageFileInput.click();
    });
    
    // Sélection de fichier
    imageFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleImageUpload(file);
    });
    
    // Drag & Drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageUpload(file);
        }
    });
    
    // Supprimer l'image
    document.getElementById('btn-remove-image').addEventListener('click', (e) => {
        e.stopPropagation();
        removeImage();
    });
    
    // ============================================
    // BOUTON AJOUTER SÉQUENCE (NOUVEAU)
    // ============================================
    const btnAddSeq = document.getElementById('btn-add-sequence');
    if (btnAddSeq) {
        btnAddSeq.addEventListener('click', addSequence);
    }
}

// ============================================
// GESTION DES SÉQUENCES/NIVEAUX (NOUVEAU)
// ============================================

function initDefaultSequence() {
    sequences = [{
        id: generateSequenceId(),
        titre: 'Niveau 1',
        description: '',
        emoji: '📚'
    }];
    activeSequenceIndex = 0;
}

function generateSequenceId() {
    return 'seq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function addSequence() {
    // Collecter les données avant d'ajouter
    collectAllBlocksData();
    
    const newSeq = {
        id: generateSequenceId(),
        titre: `Niveau ${sequences.length + 1}`,
        description: '',
        emoji: '📚'
    };
    
    sequences.push(newSeq);
    activeSequenceIndex = sequences.length - 1;
    
    renderSequenceTabs();
    renderSequenceHeader();
    renderAllBlocks();
    markDirty();
    autoSave();
}

function deleteSequence(index, e) {
    if (e) e.stopPropagation();
    
    if (sequences.length <= 1) {
        alert('Vous devez garder au moins un niveau');
        return;
    }
    
    if (!confirm(`Supprimer "${sequences[index].titre}" et tous ses blocs ?`)) {
        return;
    }
    
    // Collecter les données avant de supprimer
    collectAllBlocksData();
    
    // Supprimer les blocs de cette séquence
    const seqId = sequences[index].id;
    blocks = blocks.filter(b => b.sequenceId !== seqId);
    
    // Supprimer la séquence
    sequences.splice(index, 1);
    
    // Ajuster l'index actif
    if (activeSequenceIndex >= sequences.length) {
        activeSequenceIndex = sequences.length - 1;
    }
    
    renderSequenceTabs();
    renderSequenceHeader();
    renderAllBlocks();
    markDirty();
    autoSave();
}

function selectSequence(index) {
    // Collecter les données avant de changer
    collectAllBlocksData();
    
    activeSequenceIndex = index;
    renderSequenceTabs();
    renderSequenceHeader();
    renderAllBlocks();
}

function renderSequenceTabs() {
    const container = document.getElementById('sequences-tabs-container');
    if (!container) return;
    
    container.innerHTML = sequences.map((seq, index) => `
        <button type="button" class="sequence-tab ${index === activeSequenceIndex ? 'active' : ''}" 
                onclick="selectSequence(${index})">
            <span class="tab-emoji">${seq.emoji || '📚'}</span>
            <span class="tab-title">${seq.titre}</span>
            ${sequences.length > 1 ? `<span class="tab-delete" onclick="deleteSequence(${index}, event)" title="Supprimer">×</span>` : ''}
        </button>
    `).join('');
}

function renderSequenceHeader() {
    const container = document.getElementById('sequence-header-container');
    if (!container) return;
    
    const seq = sequences[activeSequenceIndex];
    if (!seq) return;
    
    container.innerHTML = `
        <div class="sequence-header-fields">
            <div class="sequence-field sequence-emoji-field">
                <label>Emoji</label>
                <input type="text" value="${seq.emoji || '📚'}" 
                       onchange="updateSequenceField(${activeSequenceIndex}, 'emoji', this.value)"
                       maxlength="4">
            </div>
            <div class="sequence-field sequence-title-field">
                <label>Titre du niveau</label>
                <input type="text" value="${seq.titre || ''}" 
                       onchange="updateSequenceField(${activeSequenceIndex}, 'titre', this.value)"
                       placeholder="Ex: Quel duo financier formez-vous ?">
            </div>
            <div class="sequence-field sequence-desc-field">
                <label>Description (optionnelle)</label>
                <input type="text" value="${seq.description || ''}" 
                       onchange="updateSequenceField(${activeSequenceIndex}, 'description', this.value)"
                       placeholder="Courte description du niveau">
            </div>
        </div>
    `;
}

function updateSequenceField(index, field, value) {
    if (sequences[index]) {
        sequences[index][field] = value;
        renderSequenceTabs();
        markDirty();
        autoSave();
    }
}

function getActiveSequenceId() {
    return sequences[activeSequenceIndex]?.id || null;
}

function getBlocksForActiveSequence() {
    const seqId = getActiveSequenceId();
    return blocks.filter(b => b.sequenceId === seqId);
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
            // Compter les blocs et séquences
            let blocksCount = 0;
            let sequencesCount = 1;
            
            if (quiz.sequences && Array.isArray(quiz.sequences)) {
                sequencesCount = quiz.sequences.length;
            }
            if (quiz.blocks && Array.isArray(quiz.blocks)) {
                blocksCount = quiz.blocks.length;
            }
            
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
                                <small>${quiz.slug || 'pas-de-slug'} • ${sequencesCount} niveau(x)</small>
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
    // Réinitialiser l'auto-save
    resetAutoSave();
    
    currentQuizId = quizId;
    blocks = [];
    sequences = [];
    activeSequenceIndex = 0;
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
    
    // Reset l'image
    document.getElementById('image-preview-container').style.display = 'none';
    document.getElementById('image-upload-placeholder').style.display = 'flex';
    document.getElementById('quiz-image-file').value = '';
    document.getElementById('image-upload-progress').style.display = 'none';
    
    // Vider le canvas
    document.getElementById('blocks-container').innerHTML = '';
    document.getElementById('canvas-empty').style.display = 'flex';
    
    // Titre
    document.getElementById('editor-title').textContent = quizId ? 'Modifier le guide' : 'Nouveau guide';
    
    // Charger les données si édition
    if (quizId) {
        await loadQuizData(quizId);
    } else {
        // Nouveau quiz : créer une séquence par défaut
        initDefaultSequence();
    }
    
    // Rendre les onglets de séquences
    renderSequenceTabs();
    renderSequenceHeader();
    renderAllBlocks();
    
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
        
        // Charger la preview de l'image si elle existe
        if (quiz.image_url) {
            showImagePreview(quiz.image_url);
        } else {
            removeImage(true); // silent = true pour ne pas déclencher l'auto-save
        }
        
        // Charger les séquences
        if (quiz.sequences && Array.isArray(quiz.sequences) && quiz.sequences.length > 0) {
            sequences = quiz.sequences;
        } else {
            // Pas de séquences, créer une par défaut
            initDefaultSequence();
        }
        
        // Charger les blocs
        if (quiz.blocks && Array.isArray(quiz.blocks)) {
            blocks = quiz.blocks;
            
            // Migration: ajouter sequenceId aux blocs qui n'en ont pas
            const defaultSeqId = sequences[0]?.id;
            blocks.forEach(block => {
                if (!block.sequenceId && defaultSeqId) {
                    block.sequenceId = defaultSeqId;
                }
            });
        }
        
        activeSequenceIndex = 0;
        
    } catch (error) {
        console.error('Erreur chargement quiz:', error);
        alert('Erreur lors du chargement du guide');
    }
}

function closeEditor() {
    // Annuler et réinitialiser l'auto-save
    resetAutoSave();
    
    document.getElementById('quiz-editor-modal').classList.remove('active');
    currentQuizId = null;
    blocks = [];
    sequences = [];
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
        sequenceId: getActiveSequenceId(), // NOUVEAU: Associer à la séquence active
        data: getDefaultBlockData(type)
    };
    
    if (index === -1) {
        blocks.push(blockData);
    } else {
        // Trouver l'index réel dans le tableau global
        const seqBlocks = getBlocksForActiveSequence();
        if (index < seqBlocks.length) {
            const targetBlock = seqBlocks[index];
            const globalIndex = blocks.indexOf(targetBlock);
            blocks.splice(globalIndex, 0, blockData);
        } else {
            blocks.push(blockData);
        }
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
        case 'exercise-text':
            return {
                title: '',
                fields: [
                    { question: '', placeholder: '' }
                ],
                help: ''
            };
        default:
            return {};
    }
}

function renderAllBlocks() {
    const container = document.getElementById('blocks-container');
    const emptyState = document.getElementById('canvas-empty');
    
    // Filtrer les blocs pour la séquence active
    const seqBlocks = getBlocksForActiveSequence();
    
    if (seqBlocks.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    
    container.innerHTML = seqBlocks.map((block, index) => {
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
    // IMPORTANT: Utiliser setAttribute pour les inputs et textContent pour les textareas
    // car .value n'est pas capturé par outerHTML
    blockEl.querySelectorAll('.block-field').forEach(field => {
        const fieldName = field.dataset.field;
        if (block.data && block.data[fieldName] !== undefined) {
            const value = block.data[fieldName];
            if (field.tagName === 'TEXTAREA') {
                field.textContent = value;
            } else if (field.tagName === 'INPUT') {
                field.setAttribute('value', value);
            } else if (field.tagName === 'SELECT') {
                // Pour les select, on doit marquer l'option selected
                const option = field.querySelector(`option[value="${value}"]`);
                if (option) option.setAttribute('selected', 'selected');
            }
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
                // Échapper les guillemets dans le texte
                const escapedText = (opt.text || '').replace(/"/g, '&quot;');
                
                return `
                    <div class="option-item ${isCorrect}">
                        <span class="option-marker">${marker}</span>
                        <input type="text" value="${escapedText}" placeholder="Option ${i + 1}">
                        ${block.type === 'quiz' ? `<button class="option-correct-toggle" title="Bonne réponse">✓</button>` : ''}
                        <button class="option-delete" title="Supprimer">×</button>
                    </div>
                `;
            }).join('');
        }
    }
    
    // Gérer les champs pour exercise-text
    if (block.type === 'exercise-text') {
        const fieldsList = blockEl.querySelector('.exercise-text-fields');
        if (fieldsList && block.data && block.data.fields && Array.isArray(block.data.fields)) {
            fieldsList.innerHTML = block.data.fields.map((field, i) => {
                const escapedQuestion = (field.question || '').replace(/"/g, '&quot;');
                const escapedPlaceholder = (field.placeholder || '').replace(/"/g, '&quot;');
                
                return `
                    <div class="exercise-text-field-item">
                        <div class="exercise-text-field-header">
                            <span class="exercise-text-field-number">${i + 1}</span>
                            <button type="button" class="exercise-text-field-delete" title="Supprimer">×</button>
                        </div>
                        <div class="exercise-text-field-row">
                            <label>Question / Consigne</label>
                            <textarea class="exercise-text-field-question" rows="2" placeholder="Ex: Quels abonnements pourrais-tu supprimer ?">${escapedQuestion}</textarea>
                        </div>
                        <div class="exercise-text-field-row">
                            <label>Placeholder</label>
                            <input type="text" class="exercise-text-field-placeholder" value="${escapedPlaceholder}" placeholder="Ex: Netflix, Spotify...">
                        </div>
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
    
    // Déplacement vers le haut
    container.querySelectorAll('.block-action-btn.move-up').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const blockEl = e.target.closest('.block-item');
            const blockId = blockEl.dataset.blockId;
            moveBlockUp(blockId);
        });
    });
    
    // Déplacement vers le bas
    container.querySelectorAll('.block-action-btn.move-down').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const blockEl = e.target.closest('.block-item');
            const blockId = blockEl.dataset.blockId;
            moveBlockDown(blockId);
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
    
    // Exercise-text : modification des champs
    container.querySelectorAll('.exercise-text-fields input, .exercise-text-fields textarea').forEach(input => {
        input.addEventListener('input', (e) => {
            const blockEl = e.target.closest('.block-item');
            const blockId = blockEl.dataset.blockId;
            updateExerciseTextFields(blockId);
            autoSave();
        });
    });
    
    // Exercise-text : suppression d'un champ
    container.querySelectorAll('.exercise-text-field-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const fieldItem = e.target.closest('.exercise-text-field-item');
            const blockEl = e.target.closest('.block-item');
            const blockId = blockEl.dataset.blockId;
            
            // Ne pas supprimer si c'est le dernier champ
            if (blockEl.querySelectorAll('.exercise-text-field-item').length <= 1) {
                alert('Vous devez garder au moins un champ');
                return;
            }
            
            fieldItem.remove();
            updateExerciseTextFields(blockId);
            autoSave();
        });
    });
    
    // Exercise-text : ajout d'un champ
    container.querySelectorAll('.add-exercise-text-field-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const blockEl = e.target.closest('.block-item');
            const blockId = blockEl.dataset.blockId;
            const fieldsList = blockEl.querySelector('.exercise-text-fields');
            const count = fieldsList.querySelectorAll('.exercise-text-field-item').length;
            
            const newField = document.createElement('div');
            newField.className = 'exercise-text-field-item';
            newField.innerHTML = `
                <div class="exercise-text-field-header">
                    <span class="exercise-text-field-number">${count + 1}</span>
                    <button type="button" class="exercise-text-field-delete" title="Supprimer">×</button>
                </div>
                <div class="exercise-text-field-row">
                    <label>Question / Consigne</label>
                    <textarea class="exercise-text-field-question" rows="2" placeholder="Ex: Quels abonnements pourrais-tu supprimer ?"></textarea>
                </div>
                <div class="exercise-text-field-row">
                    <label>Placeholder</label>
                    <input type="text" class="exercise-text-field-placeholder" placeholder="Ex: Netflix, Spotify...">
                </div>
            `;
            
            fieldsList.appendChild(newField);
            
            // Attacher les événements
            newField.querySelectorAll('input, textarea').forEach(input => {
                input.addEventListener('input', () => {
                    updateExerciseTextFields(blockId);
                    autoSave();
                });
            });
            
            newField.querySelector('.exercise-text-field-delete').addEventListener('click', () => {
                if (blockEl.querySelectorAll('.exercise-text-field-item').length <= 1) {
                    alert('Vous devez garder au moins un champ');
                    return;
                }
                newField.remove();
                updateExerciseTextFieldNumbers(blockEl);
                updateExerciseTextFields(blockId);
                autoSave();
            });
            
            updateExerciseTextFields(blockId);
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

function updateExerciseTextFields(blockId) {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
    const fieldItems = blockEl.querySelectorAll('.exercise-text-field-item');
    
    block.data.fields = Array.from(fieldItems).map(item => ({
        question: item.querySelector('.exercise-text-field-question').value,
        placeholder: item.querySelector('.exercise-text-field-placeholder').value
    }));
    
    markDirty();
}

function updateExerciseTextFieldNumbers(blockEl) {
    blockEl.querySelectorAll('.exercise-text-field-item').forEach((item, i) => {
        const numberEl = item.querySelector('.exercise-text-field-number');
        if (numberEl) numberEl.textContent = i + 1;
    });
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
        sequenceId: block.sequenceId, // Garder la même séquence
        data: JSON.parse(JSON.stringify(block.data))
    };
    
    blocks.splice(index + 1, 0, newBlock);
    renderAllBlocks();
    markDirty();
    autoSave();
}

// ============================================
// DÉPLACEMENT HAUT/BAS DES BLOCS
// ============================================

function moveBlockUp(blockId) {
    collectAllBlocksData();
    
    const seqBlocks = getBlocksForActiveSequence();
    const blockIndex = seqBlocks.findIndex(b => b.id === blockId);
    
    if (blockIndex <= 0) return; // Déjà en haut
    
    // Trouver les index dans le tableau global
    const currentBlock = seqBlocks[blockIndex];
    const prevBlock = seqBlocks[blockIndex - 1];
    
    const globalCurrentIndex = blocks.indexOf(currentBlock);
    const globalPrevIndex = blocks.indexOf(prevBlock);
    
    // Échanger les positions
    blocks[globalCurrentIndex] = prevBlock;
    blocks[globalPrevIndex] = currentBlock;
    
    renderAllBlocks();
    markDirty();
    autoSave();
    
    // Highlight le bloc déplacé
    setTimeout(() => {
        const movedBlock = document.querySelector(`[data-block-id="${blockId}"]`);
        if (movedBlock) {
            movedBlock.classList.add('selected');
            setTimeout(() => movedBlock.classList.remove('selected'), 800);
        }
    }, 50);
}

function moveBlockDown(blockId) {
    collectAllBlocksData();
    
    const seqBlocks = getBlocksForActiveSequence();
    const blockIndex = seqBlocks.findIndex(b => b.id === blockId);
    
    if (blockIndex >= seqBlocks.length - 1) return; // Déjà en bas
    
    // Trouver les index dans le tableau global
    const currentBlock = seqBlocks[blockIndex];
    const nextBlock = seqBlocks[blockIndex + 1];
    
    const globalCurrentIndex = blocks.indexOf(currentBlock);
    const globalNextIndex = blocks.indexOf(nextBlock);
    
    // Échanger les positions
    blocks[globalCurrentIndex] = nextBlock;
    blocks[globalNextIndex] = currentBlock;
    
    renderAllBlocks();
    markDirty();
    autoSave();
    
    // Highlight le bloc déplacé
    setTimeout(() => {
        const movedBlock = document.querySelector(`[data-block-id="${blockId}"]`);
        if (movedBlock) {
            movedBlock.classList.add('selected');
            setTimeout(() => movedBlock.classList.remove('selected'), 800);
        }
    }, 50);
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
            
            // Mettre à jour l'ordre des blocs pour cette séquence
            const seqId = getActiveSequenceId();
            const otherBlocks = blocks.filter(b => b.sequenceId !== seqId);
            const reorderedBlocks = [];
            
            container.querySelectorAll('.block-item').forEach(el => {
                const blockId = el.dataset.blockId;
                const block = blocks.find(b => b.id === blockId);
                if (block) reorderedBlocks.push(block);
            });
            
            blocks = [...otherBlocks, ...reorderedBlocks];
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
        sequences: sequences, // NOUVEAU: Sauvegarder les séquences
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
            // Vérifier si un quiz avec ce slug existe déjà
            const { data: existing } = await supabaseClient
                .from('quizzes')
                .select('id')
                .eq('slug', slug)
                .maybeSingle();
            
            if (existing) {
                // Le slug existe déjà, utiliser cet ID pour update
                currentQuizId = existing.id;
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
        }
        
        if (result.error) throw result.error;
        
        isDirty = false;
        autoSaveErrorCount = 0; // Reset le compteur d'erreurs
        lastSavedData = JSON.stringify({ blocks, sequences, title, slug });
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
            
            // Collecter les champs si exercise-text
            if (block.type === 'exercise-text') {
                const fieldItems = blockEl.querySelectorAll('.exercise-text-field-item');
                block.data.fields = Array.from(fieldItems).map(item => ({
                    question: item.querySelector('.exercise-text-field-question').value,
                    placeholder: item.querySelector('.exercise-text-field-placeholder').value
                }));
            }
        }
    });
    
    console.log('✅ Données collectées:', JSON.stringify(blocks.map(b => ({id: b.id, type: b.type, data: b.data})), null, 2));
}

// ============================================
// UPLOAD IMAGE
// ============================================

async function handleImageUpload(file) {
    // Vérifier le type
    if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner une image (JPG, PNG, WebP)');
        return;
    }
    
    // Vérifier la taille (2 Mo max)
    if (file.size > 2 * 1024 * 1024) {
        alert('L\'image doit faire moins de 2 Mo');
        return;
    }
    
    const progressContainer = document.getElementById('image-upload-progress');
    const progressFill = document.getElementById('image-progress-fill');
    const progressText = document.getElementById('image-progress-text');
    
    try {
        // Afficher la progression
        progressContainer.style.display = 'block';
        progressFill.style.width = '20%';
        progressText.textContent = 'Préparation...';
        
        // Prévisualisation locale immédiate
        const reader = new FileReader();
        reader.onload = (e) => {
            showImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
        
        progressFill.style.width = '40%';
        progressText.textContent = 'Upload en cours...';
        
        // Générer un nom unique
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const ext = file.name.split('.').pop().toLowerCase();
        const fileName = `guide-${timestamp}-${randomStr}.${ext}`;
        
        progressFill.style.width = '60%';
        
        // Upload vers Supabase Storage
        const { data, error } = await supabaseClient.storage
            .from('guides-images')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) {
            // Si le bucket n'existe pas, afficher un message utile
            if (error.message.includes('bucket') || error.message.includes('not found') || error.statusCode === '404') {
                progressText.textContent = '⚠️ Bucket non configuré';
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    alert('L\'upload d\'images n\'est pas configuré.\n\nUtilisez plutôt une URL externe (Unsplash, Imgur, etc.) dans le champ "URL de l\'image".');
                }, 500);
                return;
            }
            throw error;
        }
        
        progressFill.style.width = '80%';
        progressText.textContent = 'Finalisation...';
        
        // Récupérer l'URL publique
        const { data: urlData } = supabaseClient.storage
            .from('guides-images')
            .getPublicUrl(fileName);
        
        const imageUrl = urlData.publicUrl;
        document.getElementById('quiz-image').value = imageUrl;
        
        progressFill.style.width = '100%';
        progressText.textContent = 'Upload terminé !';
        
        console.log('✅ Image uploadée:', imageUrl);
        
        // Déclencher l'auto-save
        markDirty();
        autoSave();
        
        // Cacher la progression après un délai
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
        }, 1500);
        
    } catch (error) {
        console.error('Erreur upload:', error);
        progressText.textContent = 'Erreur: ' + error.message;
        progressFill.style.width = '0%';
        progressFill.style.background = '#BF604B';
        
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressFill.style.background = 'var(--vert-fonce)';
        }, 3000);
        
        alert('Erreur lors de l\'upload: ' + error.message);
    }
}

function showImagePreview(src) {
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview');
    const placeholder = document.getElementById('image-upload-placeholder');
    
    previewImg.src = src;
    previewContainer.style.display = 'block';
    placeholder.style.display = 'none';
}

function removeImage(silent = false) {
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview');
    const placeholder = document.getElementById('image-upload-placeholder');
    const fileInput = document.getElementById('quiz-image-file');
    const imageUrlInput = document.getElementById('quiz-image');
    
    previewImg.src = '';
    previewContainer.style.display = 'none';
    placeholder.style.display = 'flex';
    fileInput.value = '';
    imageUrlInput.value = '';
    
    if (!silent) {
        markDirty();
        autoSave();
    }
}

// ============================================
// AUTO-SAVE (sauvegarde en temps réel)
// ============================================

let autoSaveTimeout = null;
let lastSavedData = null;
let autoSaveInProgress = false;
let autoSaveErrorCount = 0;
const MAX_AUTO_SAVE_ERRORS = 3;

function autoSave() {
    // Ne pas lancer si déjà en cours ou trop d'erreurs
    if (autoSaveInProgress) {
        console.log('⏳ Auto-save déjà en cours, ignoré');
        return;
    }
    
    if (autoSaveErrorCount >= MAX_AUTO_SAVE_ERRORS) {
        console.log('❌ Trop d\'erreurs auto-save, désactivé. Utilisez le bouton Enregistrer.');
        return;
    }
    
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
            // Pas assez d'infos pour sauvegarder - pas une erreur
            console.log('⏸️ Auto-save: titre ou slug manquant');
            return;
        }
        
        // Collecter les données actuelles
        collectAllBlocksData();
        
        // Vérifier si les données ont changé
        const currentData = JSON.stringify({ blocks, sequences, title, slug });
        if (currentData === lastSavedData) {
            console.log('⏸️ Auto-save: aucun changement');
            return; // Rien n'a changé
        }
        
        // Marquer comme en cours
        autoSaveInProgress = true;
        
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
                sequences: sequences, // NOUVEAU
                blocks: blocks,
                updated_at: new Date().toISOString()
            };
            
            let result;
            if (currentQuizId) {
                // Mode UPDATE
                result = await supabaseClient
                    .from('quizzes')
                    .update(quizData)
                    .eq('id', currentQuizId)
                    .select()
                    .single();
            } else {
                // Mode INSERT - vérifier d'abord si le slug existe
                const { data: existing } = await supabaseClient
                    .from('quizzes')
                    .select('id')
                    .eq('slug', slug)
                    .maybeSingle();
                
                if (existing) {
                    // Le slug existe déjà, utiliser cet ID pour update
                    currentQuizId = existing.id;
                    result = await supabaseClient
                        .from('quizzes')
                        .update(quizData)
                        .eq('id', currentQuizId)
                        .select()
                        .single();
                } else {
                    // Nouveau quiz
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
            }
            
            if (result.error) throw result.error;
            
            lastSavedData = currentData;
            isDirty = false;
            autoSaveErrorCount = 0; // Reset le compteur d'erreurs
            updateSaveStatus('saved');
            console.log('✅ Auto-save réussi');
            
        } catch (error) {
            console.error('Erreur auto-save:', error);
            autoSaveErrorCount++;
            
            if (autoSaveErrorCount >= MAX_AUTO_SAVE_ERRORS) {
                updateSaveStatus('error');
                console.error('❌ Auto-save désactivé après', MAX_AUTO_SAVE_ERRORS, 'erreurs');
            } else {
                updateSaveStatus('error');
            }
        } finally {
            autoSaveInProgress = false;
        }
    }, 2000);
}

// Réinitialiser l'auto-save (appelé quand on ouvre/ferme l'éditeur)
function resetAutoSave() {
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = null;
    }
    lastSavedData = null;
    autoSaveInProgress = false;
    autoSaveErrorCount = 0;
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
    
    // URL avec mode preview
    const previewUrl = `../guide.html?slug=${slug}&preview=true`;
    
    // Sauvegarder d'abord si des modifications
    if (isDirty) {
        if (confirm('Sauvegarder les modifications avant l\'aperçu ?')) {
            saveQuiz().then(() => {
                window.open(previewUrl, '_blank');
            });
        }
    } else {
        window.open(previewUrl, '_blank');
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