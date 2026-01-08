// ============================================
// ADMIN QUIZ - OP! Parents
// Système avec Séquences + Upload Images
// ============================================

// État global
let currentQuizId = null;
let currentDeleteId = null;
let currentSequenceIndex = -1;
let currentQuestionIndex = -1;
let tempSequenceQuestions = []; // Questions temporaires pour nouvelle séquence
let hasUnsavedChanges = false; // Track si des modifications non sauvegardées

let quizData = {
    intro: {
        title: '',
        subtitle: '',
        description: '',
        stat: '',
        statSource: '',
        benefits: []
    },
    sequences: [],
    profiles: [],
    conclusion: {
        title: '',
        notList: [],
        isList: [],
        quote: '',
        cta: ''
    },
    settings: {
        slug: '',
        duration: '5 min',
        image: '',
        published: false,
        collectEmail: false,
        showProgress: true,
        showSequenceBilan: true
    }
};

// ============================================
// INITIALISATION
// ============================================

let eventsInitialized = false; // Protection contre double binding

document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (!session) {
            window.location.href = 'login.html';
        } else {
            loadQuizzes();
            if (!eventsInitialized) {
                bindAllEvents();
                eventsInitialized = true;
            }
        }
    });
});

// ============================================
// UPLOAD D'IMAGES
// ============================================

async function uploadImage(file) {
    if (!file) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `covers/${fileName}`;
    
    try {
        const { data, error } = await supabaseClient.storage
            .from('quiz-images')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) throw error;
        
        // Récupérer l'URL publique
        const { data: urlData } = supabaseClient.storage
            .from('quiz-images')
            .getPublicUrl(filePath);
        
        return urlData.publicUrl;
    } catch (error) {
        console.error('Erreur upload:', error);
        alert('Erreur lors de l\'upload de l\'image: ' + error.message);
        return null;
    }
}

function handleImageSelect(input) {
    const file = input.files[0];
    if (!file) return;
    
    // Vérifier le type
    if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner une image');
        input.value = '';
        return;
    }
    
    // Vérifier la taille (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        alert('L\'image doit faire moins de 5MB');
        input.value = '';
        return;
    }
    
    // Prévisualisation
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('image-preview').src = e.target.result;
        document.getElementById('image-preview-container').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function removeImagePreview() {
    document.getElementById('quiz-image-file').value = '';
    document.getElementById('quiz-image').value = '';
    document.getElementById('image-preview-container').style.display = 'none';
}

// ============================================
// CHARGEMENT DES QUIZ
// ============================================

async function loadQuizzes() {
    try {
        const { data: quizzes, error } = await supabaseClient
            .from('quizzes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const { data: sequences } = await supabaseClient.from('quiz_sequences').select('quiz_id');
        const { data: questions } = await supabaseClient.from('quiz_questions').select('quiz_id');
        const { data: results } = await supabaseClient.from('quiz_results').select('quiz_id');

        const sequenceCounts = {};
        const questionCounts = {};
        const resultCounts = {};
        
        sequences?.forEach(s => { sequenceCounts[s.quiz_id] = (sequenceCounts[s.quiz_id] || 0) + 1; });
        questions?.forEach(q => { questionCounts[q.quiz_id] = (questionCounts[q.quiz_id] || 0) + 1; });
        results?.forEach(r => { resultCounts[r.quiz_id] = (resultCounts[r.quiz_id] || 0) + 1; });

        document.getElementById('total-quizzes').textContent = quizzes?.length || 0;
        document.getElementById('total-responses').textContent = results?.length || 0;
        document.getElementById('published-quizzes').textContent = quizzes?.filter(q => q.published).length || 0;

        displayQuizzes(quizzes || [], sequenceCounts, questionCounts, resultCounts);
    } catch (error) {
        console.error('Erreur chargement:', error);
        alert('Erreur de chargement: ' + error.message);
    }
}

function displayQuizzes(quizzes, sequenceCounts, questionCounts, resultCounts) {
    const tbody = document.getElementById('quizzes-list');
    
    if (quizzes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Aucun quiz. Créez-en un !</td></tr>';
        return;
    }

    tbody.innerHTML = quizzes.map(quiz => `
        <tr data-quiz-id="${quiz.id}">
            <td>
                <strong>${escapeHtml(quiz.titre)}</strong>
                <br><small style="color: var(--text-secondary);">/quiz.html?quiz=${quiz.slug}</small>
            </td>
            <td>${sequenceCounts[quiz.id] || 0}</td>
            <td>${questionCounts[quiz.id] || 0}</td>
            <td>${resultCounts[quiz.id] || 0}</td>
            <td>
                <label class="publish-toggle" title="${quiz.published ? 'Cliquer pour dépublier' : 'Cliquer pour publier'}">
                    <input type="checkbox" ${quiz.published ? 'checked' : ''} onchange="togglePublish('${quiz.id}', this.checked)">
                    <span class="publish-slider"></span>
                    <span class="publish-label ${quiz.published ? 'published' : 'draft'}">${quiz.published ? 'Publié' : 'Brouillon'}</span>
                </label>
            </td>
            <td style="white-space: nowrap;">
                <button class="btn btn-sm btn-secondary" onclick="editQuiz('${quiz.id}')" title="Modifier">✏️</button>
                <button class="btn btn-sm btn-secondary" onclick="previewQuiz('${quiz.slug}')" title="Aperçu">👁️</button>
                <button class="btn btn-sm btn-secondary" onclick="confirmDelete('${quiz.id}')" title="Supprimer">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// Basculer le statut publié/brouillon
async function togglePublish(quizId, published) {
    try {
        const { error } = await supabaseClient
            .from('quizzes')
            .update({ published: published })
            .eq('id', quizId);
        
        if (error) throw error;
        
        // Mettre à jour l'affichage
        const row = document.querySelector(`tr[data-quiz-id="${quizId}"]`);
        if (row) {
            const label = row.querySelector('.publish-label');
            const toggle = row.querySelector('.publish-toggle');
            if (label) {
                label.textContent = published ? 'Publié' : 'Brouillon';
                label.className = `publish-label ${published ? 'published' : 'draft'}`;
            }
            if (toggle) {
                toggle.title = published ? 'Cliquer pour dépublier' : 'Cliquer pour publier';
            }
        }
        
        // Mettre à jour le compteur
        const publishedCount = document.querySelectorAll('.publish-toggle input:checked').length;
        document.getElementById('published-quizzes').textContent = publishedCount;
        
        console.log(`Quiz ${quizId} ${published ? 'publié' : 'dépublié'}`);
        
    } catch (error) {
        console.error('Erreur toggle publish:', error);
        alert('Erreur: ' + error.message);
        // Remettre le toggle à son état précédent
        const checkbox = document.querySelector(`tr[data-quiz-id="${quizId}"] .publish-toggle input`);
        if (checkbox) checkbox.checked = !published;
    }
}

// ============================================
// ÉDITEUR DE QUIZ
// ============================================

function openEditor(quiz = null) {
    currentQuizId = quiz?.id || null;
    hasUnsavedChanges = false; // Reset le flag au début
    
    if (!quiz) {
        resetQuizData();
    }
    
    document.getElementById('editor-title').textContent = quiz ? 'Modifier le Quiz' : 'Nouveau Quiz';
    document.getElementById('quiz-editor-modal').classList.add('open');
    
    // Reset tabs
    document.querySelectorAll('.editor-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelector('[data-tab="intro"]').classList.add('active');
    document.getElementById('panel-intro').classList.add('active');
    
    // Reset image preview
    document.getElementById('image-preview-container').style.display = 'none';
    document.getElementById('quiz-image-file').value = '';
    
    if (quiz) {
        loadQuizData(quiz);
    } else {
        resetForm();
        initDefaultProfiles();
        renderSequences();
        renderProfiles();
    }
    
    // Après chargement, reset le flag (le chargement déclenche des événements)
    setTimeout(() => { hasUnsavedChanges = false; }, 100);
}

function closeEditor() {
    document.getElementById('quiz-editor-modal').classList.remove('open');
    currentQuizId = null;
}

function resetQuizData() {
    quizData = {
        intro: { title: '', subtitle: '', description: '', stat: '', statSource: '', benefits: [] },
        sequences: [],
        profiles: [],
        conclusion: { title: '', notList: [], isList: [], quote: '', cta: '' },
        settings: { slug: '', duration: '5 min', image: '', published: false, collectEmail: false, showProgress: true, showSequenceBilan: true }
    };
}

function resetForm() {
    document.getElementById('quiz-title').value = '';
    document.getElementById('quiz-subtitle').value = '';
    document.getElementById('quiz-description').value = '';
    document.getElementById('intro-stat').value = '';
    document.getElementById('intro-stat-source').value = '';
    document.getElementById('quiz-slug').value = '';
    document.getElementById('slug-preview').textContent = 'mon-quiz';
    document.getElementById('quiz-duration').value = '5 min';
    document.getElementById('quiz-image').value = '';
    document.getElementById('quiz-published').checked = false;
    document.getElementById('quiz-collect-email').checked = false;
    document.getElementById('quiz-show-progress').checked = true;
    document.getElementById('quiz-show-sequence-bilan').checked = true;
    document.getElementById('conclusion-title').value = '';
    document.getElementById('conclusion-quote').value = '';
    document.getElementById('conclusion-cta').value = '';
    
    // Reset lists
    resetDynamicList('benefits-list', '✓');
    resetDynamicList('conclusion-not-list', '❌');
    resetDynamicList('conclusion-is-list', '✅');
}

function resetDynamicList(listId, icon) {
    document.getElementById(listId).innerHTML = `
        <div class="dynamic-item">
            <span class="item-icon">${icon}</span>
            <input type="text" placeholder="">
            <button class="btn-remove-item">×</button>
        </div>
    `;
}

function initDefaultProfiles() {
    quizData.profiles = [
        { code: 'A', emoji: '🔒', name: 'Sécurité', title: 'Profil Sécurité', description: '', forces: [], vigilances: [], color: '#5c6bc0' },
        { code: 'B', emoji: '🛡️', name: 'Prudence', title: 'Profil Prudence', description: '', forces: [], vigilances: [], color: '#26a69a' },
        { code: 'C', emoji: '⚖️', name: 'Équilibre', title: 'Profil Équilibre', description: '', forces: [], vigilances: [], color: '#42a5f5' },
        { code: 'D', emoji: '🕊️', name: 'Liberté', title: 'Profil Liberté', description: '', forces: [], vigilances: [], color: '#ffb74d' }
    ];
}

async function loadQuizData(quiz) {
    // Remplir intro
    document.getElementById('quiz-title').value = quiz.titre || '';
    document.getElementById('quiz-subtitle').value = quiz.sous_titre || '';
    document.getElementById('quiz-description').value = quiz.description || '';
    document.getElementById('intro-stat').value = quiz.intro_stat || '';
    document.getElementById('intro-stat-source').value = quiz.intro_stat_source || '';
    
    // Settings
    document.getElementById('quiz-slug').value = quiz.slug || '';
    document.getElementById('slug-preview').textContent = quiz.slug || 'mon-quiz';
    document.getElementById('quiz-duration').value = quiz.duree || '5 min';
    document.getElementById('quiz-image').value = quiz.image_url || '';
    document.getElementById('quiz-published').checked = quiz.published || false;
    document.getElementById('quiz-collect-email').checked = quiz.collect_email || false;
    document.getElementById('quiz-show-progress').checked = quiz.show_progress !== false;
    document.getElementById('quiz-show-sequence-bilan').checked = quiz.show_sequence_bilan !== false;
    
    // Image preview si URL existe
    if (quiz.image_url) {
        document.getElementById('image-preview').src = quiz.image_url;
        document.getElementById('image-preview-container').style.display = 'block';
    }
    
    // Conclusion
    document.getElementById('conclusion-title').value = quiz.conclusion_title || '';
    document.getElementById('conclusion-quote').value = quiz.conclusion_quote || '';
    document.getElementById('conclusion-cta').value = quiz.conclusion_cta || '';
    
    // Benefits
    fillDynamicList('benefits-list', quiz.benefits || [], '✓');
    fillDynamicList('conclusion-not-list', quiz.conclusion_not || [], '❌');
    fillDynamicList('conclusion-is-list', quiz.conclusion_is || [], '✅');
    
    // Charger les séquences avec questions
    const { data: sequences } = await supabaseClient
        .from('quiz_sequences')
        .select('*')
        .eq('quiz_id', quiz.id)
        .order('numero');
    
    quizData.sequences = [];
    
    for (const seq of (sequences || [])) {
        const { data: questions } = await supabaseClient
            .from('quiz_questions')
            .select('*, quiz_answers(*)')
            .eq('sequence_id', seq.id)
            .order('numero');
        
        quizData.sequences.push({
            id: seq.id,
            title: seq.titre,
            description: seq.description || '',
            contexte: seq.contexte || '',
            stat: seq.stat || '',
            statSource: seq.stat_source || '',
            bilanTitle: seq.bilan_titre || '',
            bilanCustomText: seq.bilan_texte || '',
            profiles: seq.profiles || {},
            questions: (questions || []).map(q => ({
                id: q.id,
                type: q.type || 'single',
                question: q.question,
                insight: q.explication || '',
                answers: (q.quiz_answers || []).sort((a, b) => a.ordre - b.ordre).map(a => ({
                    id: a.id,
                    text: a.texte,
                    isCorrect: a.is_correct || false,
                    profileCode: a.code || '',
                    profileLabel: a.profil_label || '',
                    feedback: a.feedback || ''
                }))
            }))
        });
    }
    
    // Charger les profils
    const { data: profiles } = await supabaseClient
        .from('quiz_profiles')
        .select('*')
        .eq('quiz_id', quiz.id)
        .order('code');
    
    if (profiles && profiles.length > 0) {
        quizData.profiles = profiles.map(p => ({
            id: p.id,
            code: p.code,
            emoji: p.emoji || '',
            name: p.nom || '',
            title: p.titre || '',
            description: p.description || '',
            forces: p.forces || [],
            vigilances: p.vigilances || [],
            color: p.couleur || '#2D5A3D'
        }));
    } else {
        initDefaultProfiles();
    }
    
    renderSequences();
    renderProfiles();
}

function fillDynamicList(listId, items, icon) {
    const list = document.getElementById(listId);
    if (items.length > 0) {
        list.innerHTML = items.map(item => `
            <div class="dynamic-item">
                <span class="item-icon">${icon}</span>
                <input type="text" value="${escapeHtml(item)}">
                <button class="btn-remove-item">×</button>
            </div>
        `).join('');
    }
}

// ============================================
// SÉQUENCES - CORRIGÉ
// ============================================

function renderSequences() {
    const container = document.getElementById('sequences-container');
    
    if (quizData.sequences.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📑</div>
                <h3>Aucune séquence</h3>
                <p>Cliquez sur "Ajouter une séquence" pour structurer votre quiz.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = quizData.sequences.map((seq, index) => {
        // Compter les profils configurés
        const profilesCount = seq.profiles ? Object.keys(seq.profiles).filter(k => seq.profiles[k]?.name).length : 0;
        const profilesText = profilesCount > 0 ? `📊 ${profilesCount} profil${profilesCount > 1 ? 's' : ''} configuré${profilesCount > 1 ? 's' : ''}` : '<span style="color:#BF604B">⚠️ Aucun profil</span>';
        
        return `
            <div class="sequence-card" data-index="${index}">
                <div class="sequence-card-header">
                    <div class="sequence-info">
                        <span class="sequence-number">Séquence ${index + 1}</span>
                        <h3 class="sequence-title">${escapeHtml(seq.title)}</h3>
                    </div>
                    <div class="sequence-actions">
                        <button class="btn btn-sm btn-secondary" onclick="editSequence(${index})" title="Modifier">✏️</button>
                        <button class="btn btn-sm btn-secondary" onclick="duplicateSequence(${index})" title="Dupliquer">📋</button>
                        <button class="btn btn-sm btn-secondary btn-delete" onclick="deleteSequence(${index})" title="Supprimer">🗑️</button>
                    </div>
                </div>
                <div class="sequence-meta">
                    <span>❓ ${seq.questions.length} question${seq.questions.length > 1 ? 's' : ''}</span>
                    ${profilesText}
                </div>
                ${seq.questions.length > 0 ? `
                    <div class="sequence-questions-preview">
                        ${seq.questions.slice(0, 3).map((q, qi) => `
                            <div class="question-preview">
                                <span class="qp-num">Q${qi + 1}</span>
                                <span class="qp-text">${escapeHtml(q.question.substring(0, 60))}${q.question.length > 60 ? '...' : ''}</span>
                            </div>
                        `).join('')}
                        ${seq.questions.length > 3 ? `<div class="question-preview more">+ ${seq.questions.length - 3} autres questions</div>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function openSequenceModal(sequence = null, editIndex = -1) {
    currentSequenceIndex = editIndex;
    tempSequenceQuestions = []; // Reset questions temporaires
    
    document.getElementById('sequence-edit-index').value = editIndex;
    document.getElementById('sequence-modal-title').textContent = editIndex >= 0 ? 'Modifier la séquence' : 'Nouvelle séquence';
    
    // Reset infos de base
    document.getElementById('sequence-title').value = sequence?.title || '';
    document.getElementById('sequence-description').value = sequence?.description || '';
    document.getElementById('sequence-stat').value = sequence?.stat || '';
    document.getElementById('sequence-stat-source').value = sequence?.statSource || '';
    
    const bilanTitleEl = document.getElementById('sequence-bilan-title');
    if (bilanTitleEl) bilanTitleEl.value = sequence?.bilanTitle || '';
    
    // Texte personnalisé du bilan
    const customTextEl = document.getElementById('sequence-bilan-custom-text');
    if (customTextEl) customTextEl.value = sequence?.bilanCustomText || '';
    
    // Reset noms des profils
    const profiles = sequence?.profiles || {};
    ['a', 'b', 'c', 'd'].forEach(letter => {
        const nameEl = document.getElementById(`seq-profile-${letter}-name`);
        if (nameEl) nameEl.value = profiles[letter.toUpperCase()] || '';
    });
    
    // Questions de la séquence
    if (editIndex >= 0 && sequence && sequence.questions) {
        renderSequenceQuestions(sequence.questions);
    } else {
        renderSequenceQuestions(tempSequenceQuestions);
    }
    
    document.getElementById('sequence-modal').classList.add('open');
}

function renderSequenceQuestions(questions) {
    const container = document.getElementById('sequence-questions');
    
    if (!questions || questions.length === 0) {
        container.innerHTML = `
            <div class="empty-state-small">
                <p>Aucune question. Cliquez sur "Ajouter une question".</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = questions.map((q, index) => `
        <div class="seq-question-card" data-index="${index}">
            <div class="seq-question-header">
                <span class="seq-question-num">Q${index + 1}</span>
                <span class="seq-question-type">${getQuestionTypeLabel(q.type)}</span>
                <div class="seq-question-actions">
                    <button type="button" onclick="editSequenceQuestion(${index})" title="Modifier">✏️</button>
                    <button type="button" onclick="deleteSequenceQuestion(${index})" title="Supprimer">🗑️</button>
                </div>
            </div>
            <p class="seq-question-text">${escapeHtml(q.question)}</p>
            <div class="seq-question-meta">
                💬 ${q.answers.length} réponses
            </div>
        </div>
    `).join('');
}

function getQuestionTypeLabel(type) {
    const labels = { 'single': 'Choix unique', 'multiple': 'Choix multiple', 'profile': 'Profil' };
    return labels[type] || type;
}

function saveSequence() {
    const editIndex = parseInt(document.getElementById('sequence-edit-index').value);
    
    // Collecter les noms des profils
    const profiles = {};
    ['a', 'b', 'c', 'd'].forEach(letter => {
        const nameEl = document.getElementById(`seq-profile-${letter}-name`);
        const name = nameEl ? nameEl.value.trim() : '';
        if (name) {
            profiles[letter.toUpperCase()] = name;
        }
    });
    
    const bilanTitleEl = document.getElementById('sequence-bilan-title');
    const customTextEl = document.getElementById('sequence-bilan-custom-text');
    
    const sequenceData = {
        title: document.getElementById('sequence-title').value.trim(),
        description: document.getElementById('sequence-description').value.trim(),
        stat: document.getElementById('sequence-stat').value.trim(),
        statSource: document.getElementById('sequence-stat-source').value.trim(),
        bilanTitle: bilanTitleEl ? bilanTitleEl.value.trim() : '',
        bilanCustomText: customTextEl ? customTextEl.value.trim() : '',
        profiles: profiles,
        questions: editIndex >= 0 ? quizData.sequences[editIndex].questions : tempSequenceQuestions
    };
    
    if (!sequenceData.title) {
        alert('Veuillez entrer un titre pour la séquence');
        return;
    }
    
    if (editIndex >= 0) {
        quizData.sequences[editIndex] = { ...quizData.sequences[editIndex], ...sequenceData };
    } else {
        quizData.sequences.push(sequenceData);
    }
    
    console.log('Séquence sauvegardée:', sequenceData);
    markAsChanged();
    closeSequenceModal();
    renderSequences();
}

function closeSequenceModal() {
    document.getElementById('sequence-modal').classList.remove('open');
    currentSequenceIndex = -1;
    tempSequenceQuestions = [];
}

function editSequence(index) {
    openSequenceModal(quizData.sequences[index], index);
}

function deleteSequence(index) {
    if (confirm('Supprimer cette séquence et toutes ses questions ?')) {
        quizData.sequences.splice(index, 1);
        markAsChanged();
        renderSequences();
    }
}

function duplicateSequence(index) {
    const copy = JSON.parse(JSON.stringify(quizData.sequences[index]));
    delete copy.id;
    copy.title += ' (copie)';
    copy.questions.forEach(q => {
        delete q.id;
        q.answers.forEach(a => delete a.id);
    });
    quizData.sequences.splice(index + 1, 0, copy);
    markAsChanged();
    renderSequences();
}

// ============================================
// QUESTIONS (dans séquence) - CORRIGÉ
// ============================================

function openQuestionModal(question = null, editIndex = -1) {
    currentQuestionIndex = editIndex;
    document.getElementById('question-edit-index').value = editIndex;
    document.getElementById('question-modal-title').textContent = editIndex >= 0 ? 'Modifier la question' : 'Nouvelle question';
    
    // Reset
    document.querySelectorAll('input[name="question-type"]').forEach(r => r.checked = r.value === (question?.type || 'single'));
    document.getElementById('question-text').value = question?.question || '';
    document.getElementById('question-insight').value = question?.insight || '';
    
    // Réponses
    const builder = document.getElementById('answers-builder');
    builder.innerHTML = '';
    
    if (question && question.answers.length > 0) {
        question.answers.forEach((a, i) => addAnswer(a, i));
    } else {
        for (let i = 0; i < 4; i++) addAnswer(null, i);
    }
    
    document.getElementById('question-modal').classList.add('open');
}

function addAnswer(answer = null, index = null) {
    const builder = document.getElementById('answers-builder');
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const idx = index !== null ? index : builder.children.length;
    const letter = letters[idx] || String(idx + 1);
    
    const profileOptions = quizData.profiles.map(p => 
        `<option value="${p.code}" ${answer?.profileCode === p.code ? 'selected' : ''}>${p.emoji} ${p.name}</option>`
    ).join('');
    
    const html = `
        <div class="answer-item" data-index="${idx}">
            <div class="answer-header">
                <span class="answer-letter">${letter}</span>
                <input type="text" class="answer-text" placeholder="Texte de la réponse" value="${escapeHtml(answer?.text || '')}">
                <button type="button" class="btn-remove-answer" onclick="removeAnswer(this)">×</button>
            </div>
            <div class="answer-options">
                <label class="answer-option">
                    <input type="checkbox" class="answer-correct" ${answer?.isCorrect ? 'checked' : ''}>
                    <span>✅ Correcte</span>
                </label>
                <div class="answer-option">
                    <span>Profil:</span>
                    <select class="answer-profile">
                        <option value="">--</option>
                        ${profileOptions}
                    </select>
                </div>
            </div>
            <div class="answer-feedback-row">
                <input type="text" class="answer-feedback" placeholder="Feedback si sélectionné (optionnel)" value="${escapeHtml(answer?.feedback || '')}">
            </div>
        </div>
    `;
    
    builder.insertAdjacentHTML('beforeend', html);
}

function removeAnswer(btn) {
    btn.closest('.answer-item').remove();
    reindexAnswers();
}

function reindexAnswers() {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    document.querySelectorAll('#answers-builder .answer-item').forEach((item, i) => {
        item.querySelector('.answer-letter').textContent = letters[i] || String(i + 1);
        item.dataset.index = i;
    });
}

function saveQuestion() {
    const editIndex = parseInt(document.getElementById('question-edit-index').value);
    const type = document.querySelector('input[name="question-type"]:checked').value;
    
    const question = {
        type: type,
        question: document.getElementById('question-text').value.trim(),
        insight: document.getElementById('question-insight').value.trim(),
        answers: []
    };
    
    document.querySelectorAll('#answers-builder .answer-item').forEach(item => {
        const text = item.querySelector('.answer-text').value.trim();
        if (text) {
            question.answers.push({
                text: text,
                isCorrect: item.querySelector('.answer-correct').checked,
                profileCode: item.querySelector('.answer-profile').value,
                feedback: item.querySelector('.answer-feedback').value.trim()
            });
        }
    });
    
    if (!question.question) {
        alert('Veuillez entrer le texte de la question');
        return;
    }
    
    if (question.answers.length < 2) {
        alert('Veuillez ajouter au moins 2 réponses');
        return;
    }
    
    // Ajouter/modifier dans la séquence courante OU dans les questions temporaires
    if (currentSequenceIndex >= 0) {
        // Mode édition d'une séquence existante
        if (editIndex >= 0) {
            quizData.sequences[currentSequenceIndex].questions[editIndex] = question;
        } else {
            quizData.sequences[currentSequenceIndex].questions.push(question);
        }
        renderSequenceQuestions(quizData.sequences[currentSequenceIndex].questions);
    } else {
        // Mode nouvelle séquence: stocker dans les questions temporaires
        if (editIndex >= 0) {
            tempSequenceQuestions[editIndex] = question;
        } else {
            tempSequenceQuestions.push(question);
        }
        renderSequenceQuestions(tempSequenceQuestions);
    }
    
    console.log('Question sauvegardée:', question);
    markAsChanged();
    closeQuestionModal();
}

function closeQuestionModal() {
    document.getElementById('question-modal').classList.remove('open');
    currentQuestionIndex = -1;
}

function editSequenceQuestion(index) {
    let questions;
    if (currentSequenceIndex >= 0) {
        questions = quizData.sequences[currentSequenceIndex].questions;
    } else {
        questions = tempSequenceQuestions;
    }
    openQuestionModal(questions[index], index);
}

function deleteSequenceQuestion(index) {
    if (!confirm('Supprimer cette question ?')) return;
    
    if (currentSequenceIndex >= 0) {
        quizData.sequences[currentSequenceIndex].questions.splice(index, 1);
        renderSequenceQuestions(quizData.sequences[currentSequenceIndex].questions);
    } else {
        tempSequenceQuestions.splice(index, 1);
        renderSequenceQuestions(tempSequenceQuestions);
    }
    markAsChanged();
}

// ============================================
// PROFILS
// ============================================

function renderProfiles() {
    const container = document.getElementById('profiles-container');
    
    if (quizData.profiles.length === 0) {
        container.innerHTML = '<p class="empty">Aucun profil.</p>';
        return;
    }
    
    container.innerHTML = quizData.profiles.map((p, index) => `
        <div class="profile-card" data-index="${index}">
            <div class="profile-header">
                <input type="color" class="profile-color" value="${p.color || '#2D5A3D'}" onchange="updateProfile(${index}, 'color', this.value)">
                <div class="profile-header-inputs">
                    <input type="text" class="profile-emoji" value="${escapeHtml(p.emoji)}" placeholder="🎯" onchange="updateProfile(${index}, 'emoji', this.value)">
                    <input type="text" class="profile-code" value="${escapeHtml(p.code)}" maxlength="1" placeholder="A" onchange="updateProfile(${index}, 'code', this.value.toUpperCase())">
                    <input type="text" class="profile-name" value="${escapeHtml(p.name)}" placeholder="Nom" onchange="updateProfile(${index}, 'name', this.value)">
                </div>
                <button type="button" class="btn-remove-profile" onclick="removeProfile(${index})">×</button>
            </div>
            <div class="profile-body">
                <input type="text" value="${escapeHtml(p.title)}" placeholder="Titre complet" onchange="updateProfile(${index}, 'title', this.value)">
                <textarea rows="2" placeholder="Description..." onchange="updateProfile(${index}, 'description', this.value)">${escapeHtml(p.description)}</textarea>
                <div class="profile-lists">
                    <div>
                        <label>Forces (une par ligne)</label>
                        <textarea rows="3" onchange="updateProfileList(${index}, 'forces', this.value)">${(p.forces || []).join('\n')}</textarea>
                    </div>
                    <div>
                        <label>Vigilances (une par ligne)</label>
                        <textarea rows="3" onchange="updateProfileList(${index}, 'vigilances', this.value)">${(p.vigilances || []).join('\n')}</textarea>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function addProfile() {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const usedCodes = quizData.profiles.map(p => p.code);
    const nextCode = letters.find(l => !usedCodes.includes(l)) || String(quizData.profiles.length + 1);
    
    quizData.profiles.push({
        code: nextCode,
        emoji: '🎯',
        name: 'Nouveau profil',
        title: '',
        description: '',
        forces: [],
        vigilances: [],
        color: '#2D5A3D'
    });
    
    markAsChanged();
    renderProfiles();
}

function removeProfile(index) {
    if (confirm('Supprimer ce profil ?')) {
        quizData.profiles.splice(index, 1);
        markAsChanged();
        renderProfiles();
    }
}

function updateProfile(index, field, value) {
    quizData.profiles[index][field] = value;
    markAsChanged();
}

function updateProfileList(index, field, value) {
    quizData.profiles[index][field] = value.split('\n').filter(v => v.trim());
    markAsChanged();
}

// ============================================
// SAUVEGARDE - AVEC UPLOAD IMAGE
// ============================================

let isSaving = false; // Protection contre double-clic

async function saveQuiz() {
    // Protection contre les appels multiples
    if (isSaving) {
        console.log('⚠️ Sauvegarde déjà en cours, ignoré');
        return false;
    }
    isSaving = true;
    
    // Désactiver les boutons immédiatement
    const btnSave = document.getElementById('btn-save');
    const btnSaveClose = document.getElementById('btn-save-close');
    if (btnSave) btnSave.disabled = true;
    if (btnSaveClose) btnSaveClose.disabled = true;
    
    const saveStatus = document.getElementById('save-status');
    saveStatus.textContent = 'Enregistrement...';
    saveStatus.className = 'save-status saving';
    
    try {
        // Upload image si fichier sélectionné
        let imageUrl = document.getElementById('quiz-image').value.trim();
        const imageFile = document.getElementById('quiz-image-file').files[0];
        
        if (imageFile) {
            saveStatus.textContent = 'Upload image...';
            const uploadedUrl = await uploadImage(imageFile);
            if (uploadedUrl) {
                imageUrl = uploadedUrl;
            }
        }
        
        // Collecter les listes
        const benefits = collectDynamicList('benefits-list');
        const conclusionNot = collectDynamicList('conclusion-not-list');
        const conclusionIs = collectDynamicList('conclusion-is-list');
        
        const quizPayload = {
            titre: document.getElementById('quiz-title').value.trim(),
            sous_titre: document.getElementById('quiz-subtitle').value.trim(),
            description: document.getElementById('quiz-description').value.trim(),
            intro_stat: document.getElementById('intro-stat').value.trim(),
            intro_stat_source: document.getElementById('intro-stat-source').value.trim(),
            benefits: benefits,
            slug: document.getElementById('quiz-slug').value.trim(),
            duree: document.getElementById('quiz-duration').value.trim(),
            image_url: imageUrl,
            published: document.getElementById('quiz-published').checked,
            collect_email: document.getElementById('quiz-collect-email').checked,
            show_progress: document.getElementById('quiz-show-progress').checked,
            show_sequence_bilan: document.getElementById('quiz-show-sequence-bilan').checked,
            conclusion_title: document.getElementById('conclusion-title').value.trim(),
            conclusion_quote: document.getElementById('conclusion-quote').value.trim(),
            conclusion_cta: document.getElementById('conclusion-cta').value.trim(),
            conclusion_not: conclusionNot,
            conclusion_is: conclusionIs
        };
        
        if (!quizPayload.titre || !quizPayload.slug) {
            alert('Le titre et le slug sont obligatoires');
            saveStatus.textContent = '';
            return;
        }
        
        // Vérifier si le slug existe déjà (pour un autre quiz)
        const { data: existingQuiz } = await supabaseClient
            .from('quizzes')
            .select('id')
            .eq('slug', quizPayload.slug)
            .maybeSingle();
        
        if (existingQuiz && existingQuiz.id !== currentQuizId) {
            alert(`Le slug "${quizPayload.slug}" est déjà utilisé par un autre quiz. Veuillez en choisir un autre.`);
            saveStatus.textContent = '';
            return;
        }
        
        console.log('Payload quiz:', quizPayload);
        console.log('Séquences à sauvegarder:', quizData.sequences);
        console.log('currentQuizId:', currentQuizId);
        
        saveStatus.textContent = 'Sauvegarde quiz...';
        
        let quizId = currentQuizId;
        
        if (currentQuizId) {
            console.log('Mode UPDATE pour quiz:', currentQuizId);
            const { error } = await supabaseClient.from('quizzes').update(quizPayload).eq('id', currentQuizId);
            if (error) throw error;
        } else {
            console.log('Mode INSERT nouveau quiz');
            const { data, error } = await supabaseClient.from('quizzes').insert(quizPayload).select().single();
            if (error) throw error;
            quizId = data.id;
            currentQuizId = quizId;
            console.log('Nouveau quiz créé avec ID:', quizId);
        }
        
        // Sauvegarder profils
        saveStatus.textContent = 'Sauvegarde profils...';
        const { error: delProfErr } = await supabaseClient.from('quiz_profiles').delete().eq('quiz_id', quizId);
        if (delProfErr) {
            console.error('Erreur suppression profils:', delProfErr);
        }
        
        if (quizData.profiles.length > 0) {
            const profilesPayload = quizData.profiles.map(p => ({
                quiz_id: quizId,
                code: p.code,
                emoji: p.emoji,
                nom: p.name,
                titre: p.title,
                description: p.description,
                forces: p.forces,
                vigilances: p.vigilances,
                couleur: p.color
            }));
            const { error: profErr } = await supabaseClient.from('quiz_profiles').insert(profilesPayload);
            if (profErr) throw profErr;
        }
        
        // Supprimer les anciennes données (dans l'ordre pour respecter les foreign keys)
        saveStatus.textContent = 'Nettoyage anciennes données...';
        console.log('Suppression des anciennes données pour quiz_id:', quizId);
        
        // 1. Supprimer les réponses (via les questions du quiz)
        const { data: oldQuestions } = await supabaseClient
            .from('quiz_questions')
            .select('id')
            .eq('quiz_id', quizId);
        
        console.log('Questions existantes à supprimer:', oldQuestions?.length || 0);
        
        if (oldQuestions && oldQuestions.length > 0) {
            const questionIds = oldQuestions.map(q => q.id);
            const { error: delAnsErr, count: ansCount } = await supabaseClient
                .from('quiz_answers')
                .delete()
                .in('question_id', questionIds);
            console.log('Réponses supprimées:', ansCount, delAnsErr ? 'ERREUR:' + delAnsErr.message : 'OK');
        }
        
        // 2. Supprimer les questions
        const { error: delQErr, count: qCount } = await supabaseClient
            .from('quiz_questions')
            .delete()
            .eq('quiz_id', quizId);
        console.log('Questions supprimées:', qCount, delQErr ? 'ERREUR:' + delQErr.message : 'OK');
        
        // 3. Supprimer les séquences
        const { error: delSeqErr, count: seqCount } = await supabaseClient
            .from('quiz_sequences')
            .delete()
            .eq('quiz_id', quizId);
        console.log('Séquences supprimées:', seqCount, delSeqErr ? 'ERREUR:' + delSeqErr.message : 'OK');
        
        // Vérification que les séquences ont bien été supprimées
        const { data: checkSeq } = await supabaseClient
            .from('quiz_sequences')
            .select('id')
            .eq('quiz_id', quizId);
        
        if (checkSeq && checkSeq.length > 0) {
            console.warn('⚠️ ATTENTION: Il reste encore', checkSeq.length, 'séquences non supprimées!');
            console.warn('Les policies RLS bloquent peut-être la suppression.');
            console.warn('Exécutez le script fix-rls-policies.sql dans Supabase.');
            // On continue quand même pour ne pas bloquer
        }
        
        console.log('✅ Anciennes données supprimées, insertion des nouvelles...');
        
        // Sauvegarder les nouvelles séquences et questions
        saveStatus.textContent = 'Sauvegarde séquences...';
        
        // Sauvegarder les nouvelles séquences et questions
        for (let i = 0; i < quizData.sequences.length; i++) {
            const seq = quizData.sequences[i];
            console.log(`Sauvegarde séquence ${i + 1}:`, seq.title, `(${seq.questions.length} questions)`);
            
            const seqPayload = {
                quiz_id: quizId,
                numero: i + 1,
                titre: seq.title,
                description: seq.description || null,
                contexte: seq.contexte || null,
                stat: seq.stat || null,
                stat_source: seq.statSource || null,
                bilan_titre: seq.bilanTitle || null,
                bilan_texte: seq.bilanCustomText || null,
                profiles: seq.profiles || null
            };
            console.log('Payload séquence:', seqPayload);
            
            const { data: seqData, error: seqErr } = await supabaseClient
                .from('quiz_sequences')
                .insert(seqPayload)
                .select()
                .single();
            
            console.log('Résultat insertion séquence:', { seqData, seqErr });
            
            if (seqErr) {
                console.error('Erreur séquence:', seqErr);
                throw seqErr;
            }
            
            if (!seqData || !seqData.id) {
                console.error('seqData est null ou sans id:', seqData);
                throw new Error('Échec création séquence - pas de données retournées. Vérifiez les policies RLS.');
            }
            
            console.log('Séquence créée avec ID:', seqData.id);
            
            // Questions de la séquence
            for (let j = 0; j < seq.questions.length; j++) {
                const q = seq.questions[j];
                console.log(`  Question ${j + 1}:`, q.question.substring(0, 50), '- sequence_id:', seqData.id);
                
                const { data: qData, error: qErr } = await supabaseClient.from('quiz_questions').insert({
                    quiz_id: quizId,
                    sequence_id: seqData.id,
                    numero: j + 1,
                    type: q.type,
                    question: q.question,
                    explication: q.insight || null
                }).select().single();
                
                if (qErr) {
                    console.error('Erreur question:', qErr);
                    throw qErr;
                }
                
                if (!qData || !qData.id) {
                    console.error('qData est null ou sans id:', qData);
                    throw new Error('Échec création question - pas de données retournées.');
                }
                
                // Réponses
                if (q.answers && q.answers.length > 0) {
                    const answersPayload = q.answers.map((a, k) => ({
                        question_id: qData.id,
                        code: a.profileCode || ['A', 'B', 'C', 'D'][k] || String(k + 1),
                        texte: a.text,
                        is_correct: a.isCorrect || false,
                        profil_label: a.profileLabel || '',
                        feedback: a.feedback || '',
                        ordre: k
                    }));
                    const { error: aErr } = await supabaseClient.from('quiz_answers').insert(answersPayload);
                    if (aErr) {
                        console.error('Erreur réponses:', aErr);
                        throw aErr;
                    }
                }
            }
        }
        
        // Marquer comme sauvegardé
        hasUnsavedChanges = false;
        
        saveStatus.textContent = '✓ Enregistré';
        saveStatus.className = 'save-status saved';
        setTimeout(() => { saveStatus.textContent = ''; }, 3000);
        
        console.log('Quiz sauvegardé avec succès!');
        return true;
        
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur: ' + error.message);
        saveStatus.textContent = 'Erreur';
        saveStatus.className = 'save-status error';
        return false;
    } finally {
        // Toujours réinitialiser le flag et réactiver les boutons
        isSaving = false;
        const btnSave = document.getElementById('btn-save');
        const btnSaveClose = document.getElementById('btn-save-close');
        if (btnSave) btnSave.disabled = false;
        if (btnSaveClose) btnSaveClose.disabled = false;
    }
}

function collectDynamicList(listId) {
    const items = [];
    document.querySelectorAll(`#${listId} input`).forEach(input => {
        if (input.value.trim()) items.push(input.value.trim());
    });
    return items;
}

// ============================================
// ACTIONS
// ============================================

async function editQuiz(id) {
    const { data: quiz, error } = await supabaseClient.from('quizzes').select('*').eq('id', id).single();
    if (error) {
        alert('Erreur: ' + error.message);
        return;
    }
    if (quiz) openEditor(quiz);
}

function previewQuiz(slug) {
    window.open(`../quiz.html?quiz=${slug}&preview=true`, '_blank');
}

function confirmDelete(id) {
    currentDeleteId = id;
    document.getElementById('delete-modal').classList.add('open');
}

async function deleteQuiz() {
    if (!currentDeleteId) return;
    const { error } = await supabaseClient.from('quizzes').delete().eq('id', currentDeleteId);
    if (error) {
        alert('Erreur: ' + error.message);
        return;
    }
    document.getElementById('delete-modal').classList.remove('open');
    currentDeleteId = null;
    loadQuizzes();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// ÉVÉNEMENTS
// ============================================

function bindAllEvents() {
    // Nouveau quiz
    document.getElementById('new-quiz-btn').addEventListener('click', () => openEditor());
    
    // Retour - ne demande confirmation que s'il y a des changements non sauvegardés
    document.getElementById('btn-back').addEventListener('click', () => {
        if (hasUnsavedChanges) {
            if (confirm('Des modifications non enregistrées seront perdues. Quitter quand même ?')) {
                closeEditor();
                loadQuizzes();
            }
        } else {
            closeEditor();
            loadQuizzes();
        }
    });
    
    // Sauvegarder
    document.getElementById('btn-save').addEventListener('click', saveQuiz);
    
    // Sauvegarder et quitter
    document.getElementById('btn-save-close')?.addEventListener('click', async () => {
        await saveQuiz();
        if (!hasUnsavedChanges) { // Si la sauvegarde a réussi
            closeEditor();
            loadQuizzes();
        }
    });
    
    // Aperçu
    document.getElementById('btn-preview').addEventListener('click', () => {
        const slug = document.getElementById('quiz-slug').value;
        if (slug) previewQuiz(slug);
        else alert('Définissez d\'abord un slug');
    });
    
    // Onglets
    document.querySelectorAll('.editor-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.editor-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
        });
    });
    
    // Ajouter bénéfice
    document.getElementById('add-benefit-btn').addEventListener('click', () => {
        addDynamicItem('benefits-list', '✓');
        markAsChanged();
    });
    
    // Ajouter items dynamiques
    document.querySelectorAll('.add-dynamic-item').forEach(btn => {
        btn.addEventListener('click', () => {
            addDynamicItem(btn.dataset.target, btn.dataset.icon);
            markAsChanged();
        });
    });
    
    // Supprimer items (délégation)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-item')) {
            e.target.closest('.dynamic-item').remove();
            markAsChanged();
        }
    });
    
    // Séquences
    document.getElementById('add-sequence-btn').addEventListener('click', () => openSequenceModal());
    document.getElementById('sequence-save-btn').addEventListener('click', saveSequence);
    document.getElementById('sequence-cancel-btn').addEventListener('click', closeSequenceModal);
    document.getElementById('sequence-modal-close').addEventListener('click', closeSequenceModal);
    document.querySelector('#sequence-modal .modal-overlay').addEventListener('click', closeSequenceModal);
    
    // Questions dans séquence
    document.getElementById('add-seq-question-btn').addEventListener('click', () => openQuestionModal());
    document.getElementById('add-answer-btn').addEventListener('click', () => addAnswer());
    document.getElementById('question-save-btn').addEventListener('click', saveQuestion);
    document.getElementById('question-cancel-btn').addEventListener('click', closeQuestionModal);
    document.getElementById('question-modal-close').addEventListener('click', closeQuestionModal);
    document.querySelector('#question-modal .modal-overlay').addEventListener('click', closeQuestionModal);
    
    // Profils
    document.getElementById('add-profile-btn').addEventListener('click', addProfile);
    
    // Auto-slug
    document.getElementById('quiz-title').addEventListener('input', (e) => {
        if (!currentQuizId) {
            const slug = e.target.value.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            document.getElementById('quiz-slug').value = slug;
            document.getElementById('slug-preview').textContent = slug || 'mon-quiz';
        }
    });
    
    document.getElementById('quiz-slug').addEventListener('input', (e) => {
        document.getElementById('slug-preview').textContent = e.target.value || 'mon-quiz';
    });
    
    // Upload image
    document.getElementById('quiz-image-file').addEventListener('change', (e) => {
        handleImageSelect(e.target);
    });
    
    document.getElementById('remove-image-btn').addEventListener('click', removeImagePreview);
    
    // Delete modal
    document.getElementById('delete-modal-close').addEventListener('click', () => document.getElementById('delete-modal').classList.remove('open'));
    document.getElementById('delete-cancel').addEventListener('click', () => document.getElementById('delete-modal').classList.remove('open'));
    document.getElementById('delete-confirm').addEventListener('click', deleteQuiz);
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    });
    
    // Tracking des changements sur tous les inputs du formulaire
    document.getElementById('quiz-editor-modal').addEventListener('input', (e) => {
        if (e.target.matches('input, textarea, select')) {
            markAsChanged();
        }
    });
    
    document.getElementById('quiz-editor-modal').addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"], input[type="color"], select')) {
            markAsChanged();
        }
    });
}

function addDynamicItem(listId, icon) {
    const list = document.getElementById(listId);
    list.insertAdjacentHTML('beforeend', `
        <div class="dynamic-item">
            <span class="item-icon">${icon}</span>
            <input type="text" placeholder="">
            <button class="btn-remove-item">×</button>
        </div>
    `);
}

// Marquer qu'il y a des modifications non sauvegardées
function markAsChanged() {
    hasUnsavedChanges = true;
}