// ============================================
// ADMIN QUIZ - OP! Parents
// Éditeur complet et moderne
// ============================================

// État global
let currentQuizId = null;
let currentDeleteId = null;
let quizData = {
    intro: {
        title: '',
        subtitle: '',
        description: '',
        stat: '',
        statSource: '',
        benefits: [],
        scientific: ''
    },
    questions: [],
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
        duration: '3 min',
        image: '',
        published: false,
        collectEmail: false,
        showProgress: true
    }
};

// Initialiser Supabase
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    
    // Vérifier l'authentification
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (!session) {
            window.location.href = 'login.html';
        } else {
            loadQuizzes();
            bindAllEvents();
        }
    });
});

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

        // Charger les stats
        const { data: questions } = await supabaseClient.from('quiz_questions').select('quiz_id');
        const { data: results } = await supabaseClient.from('quiz_results').select('quiz_id');

        // Compter par quiz
        const questionCounts = {};
        const resultCounts = {};
        
        questions?.forEach(q => {
            questionCounts[q.quiz_id] = (questionCounts[q.quiz_id] || 0) + 1;
        });
        
        results?.forEach(r => {
            resultCounts[r.quiz_id] = (resultCounts[r.quiz_id] || 0) + 1;
        });

        // Stats globales
        document.getElementById('total-quizzes').textContent = quizzes?.length || 0;
        document.getElementById('total-responses').textContent = results?.length || 0;
        document.getElementById('published-quizzes').textContent = 
            quizzes?.filter(q => q.published).length || 0;

        displayQuizzes(quizzes || [], questionCounts, resultCounts);
    } catch (error) {
        console.error('Erreur chargement:', error);
    }
}

function displayQuizzes(quizzes, questionCounts, resultCounts) {
    const tbody = document.getElementById('quizzes-list');
    
    if (quizzes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Aucun quiz. Créez-en un !</td></tr>';
        return;
    }

    tbody.innerHTML = quizzes.map(quiz => `
        <tr>
            <td>
                <strong>${quiz.titre}</strong>
                <br><small style="color: var(--text-secondary);">/quiz.html?quiz=${quiz.slug}</small>
            </td>
            <td>${questionCounts[quiz.id] || 0}</td>
            <td>${resultCounts[quiz.id] || 0}</td>
            <td>
                <span class="status-badge ${quiz.published ? 'status-published' : 'status-draft'}">
                    ${quiz.published ? 'Publié' : 'Brouillon'}
                </span>
            </td>
            <td style="white-space: nowrap;">
                <button class="btn btn-sm btn-secondary" onclick="editQuiz('${quiz.id}')" title="Modifier">✏️</button>
                <button class="btn btn-sm btn-secondary" onclick="previewQuiz('${quiz.slug}')" title="Aperçu">👁️</button>
                <button class="btn btn-sm btn-secondary" onclick="confirmDelete('${quiz.id}')" title="Supprimer">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// ============================================
// ÉDITEUR DE QUIZ
// ============================================

function openEditor(quiz = null) {
    currentQuizId = quiz?.id || null;
    
    // Reset des données
    if (!quiz) {
        quizData = {
            intro: { title: '', subtitle: '', description: '', stat: '', statSource: '', benefits: [], scientific: '' },
            questions: [],
            profiles: [],
            conclusion: { title: '', notList: [], isList: [], quote: '', cta: '' },
            settings: { slug: '', duration: '3 min', image: '', published: false, collectEmail: false, showProgress: true }
        };
    }
    
    document.getElementById('editor-title').textContent = quiz ? 'Modifier le Quiz' : 'Nouveau Quiz';
    
    // Afficher l'éditeur
    document.getElementById('quiz-editor-modal').classList.add('open');
    
    // Reset tabs
    document.querySelectorAll('.editor-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelector('[data-tab="intro"]').classList.add('active');
    document.getElementById('panel-intro').classList.add('active');
    
    // Si édition, charger les données
    if (quiz) {
        loadQuizData(quiz);
    } else {
        // Reset le formulaire
        resetForm();
        initDefaultProfiles();
    }
    
    renderQuestions();
    renderProfiles();
}

function closeEditor() {
    document.getElementById('quiz-editor-modal').classList.remove('open');
    currentQuizId = null;
}

function resetForm() {
    document.getElementById('quiz-title').value = '';
    document.getElementById('quiz-subtitle').value = '';
    document.getElementById('quiz-description').value = '';
    document.getElementById('intro-stat').value = '';
    document.getElementById('intro-stat-source').value = '';
    document.getElementById('intro-scientific').value = '';
    document.getElementById('quiz-slug').value = '';
    document.getElementById('quiz-duration').value = '3 min';
    document.getElementById('quiz-image').value = '';
    document.getElementById('quiz-published').checked = false;
    document.getElementById('quiz-collect-email').checked = false;
    document.getElementById('quiz-show-progress').checked = true;
    document.getElementById('conclusion-title').value = '';
    document.getElementById('conclusion-quote').value = '';
    document.getElementById('conclusion-cta').value = '';
    
    // Reset benefits
    const benefitsList = document.getElementById('benefits-list');
    benefitsList.innerHTML = `
        <div class="benefit-item">
            <span class="benefit-icon">✓</span>
            <input type="text" class="benefit-input" placeholder="Ex: Si ton rapport à l'argent est dominé par la sécurité ou la liberté">
            <button class="btn-remove-benefit" title="Supprimer">×</button>
        </div>
    `;
    
    // Reset conclusion lists
    document.getElementById('conclusion-not-list').innerHTML = `
        <div class="list-item">
            <span class="list-icon">❌</span>
            <input type="text" placeholder="Ex: Gagner plus">
            <button class="btn-remove">×</button>
        </div>
    `;
    document.getElementById('conclusion-is-list').innerHTML = `
        <div class="list-item">
            <span class="list-icon">✅</span>
            <input type="text" placeholder="Ex: Te sentir légitime">
            <button class="btn-remove">×</button>
        </div>
    `;
    
    quizData.questions = [];
    quizData.profiles = [];
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
    // Remplir les champs intro
    document.getElementById('quiz-title').value = quiz.titre || '';
    document.getElementById('quiz-subtitle').value = quiz.sous_titre || '';
    document.getElementById('quiz-description').value = quiz.description || '';
    document.getElementById('intro-stat').value = quiz.intro_stat || '';
    document.getElementById('intro-stat-source').value = quiz.intro_stat_source || '';
    document.getElementById('intro-scientific').value = quiz.intro_scientific || '';
    
    // Settings
    document.getElementById('quiz-slug').value = quiz.slug || '';
    document.getElementById('slug-preview').textContent = quiz.slug || 'mon-quiz';
    document.getElementById('quiz-duration').value = quiz.duree || '3 min';
    document.getElementById('quiz-image').value = quiz.image_url || '';
    document.getElementById('quiz-published').checked = quiz.published || false;
    document.getElementById('quiz-collect-email').checked = quiz.collect_email || false;
    document.getElementById('quiz-show-progress').checked = quiz.show_progress !== false;
    
    // Conclusion
    document.getElementById('conclusion-title').value = quiz.conclusion_title || '';
    document.getElementById('conclusion-quote').value = quiz.conclusion_quote || '';
    document.getElementById('conclusion-cta').value = quiz.conclusion_cta || '';
    
    // Benefits
    const benefits = quiz.benefits || [];
    const benefitsList = document.getElementById('benefits-list');
    if (benefits.length > 0) {
        benefitsList.innerHTML = benefits.map(b => `
            <div class="benefit-item">
                <span class="benefit-icon">✓</span>
                <input type="text" class="benefit-input" value="${escapeHtml(b)}">
                <button class="btn-remove-benefit" title="Supprimer">×</button>
            </div>
        `).join('');
    }
    
    // Conclusion lists
    const notList = quiz.conclusion_not || [];
    const isList = quiz.conclusion_is || [];
    
    if (notList.length > 0) {
        document.getElementById('conclusion-not-list').innerHTML = notList.map(item => `
            <div class="list-item">
                <span class="list-icon">❌</span>
                <input type="text" value="${escapeHtml(item)}">
                <button class="btn-remove">×</button>
            </div>
        `).join('');
    }
    
    if (isList.length > 0) {
        document.getElementById('conclusion-is-list').innerHTML = isList.map(item => `
            <div class="list-item">
                <span class="list-icon">✅</span>
                <input type="text" value="${escapeHtml(item)}">
                <button class="btn-remove">×</button>
            </div>
        `).join('');
    }
    
    // Charger les questions
    const { data: questions } = await supabaseClient
        .from('quiz_questions')
        .select('*, quiz_answers(*)')
        .eq('quiz_id', quiz.id)
        .order('numero');
    
    quizData.questions = (questions || []).map(q => ({
        id: q.id,
        type: q.type || 'single',
        contextTitle: q.context_title || '',
        context: q.context || '',
        stat: q.stat || '',
        statSource: q.stat_source || '',
        question: q.question || '',
        insight: q.explication || '',
        answers: (q.quiz_answers || []).sort((a, b) => a.ordre - b.ordre).map(a => ({
            id: a.id,
            text: a.texte || '',
            isCorrect: a.is_correct || false,
            profileCode: a.code || '',
            profileLabel: a.profil_label || '',
            feedback: a.feedback || ''
        }))
    }));
    
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
    
    renderQuestions();
    renderProfiles();
}

// ============================================
// QUESTIONS
// ============================================

function renderQuestions() {
    const container = document.getElementById('questions-container');
    
    if (quizData.questions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❓</div>
                <h3>Aucune question</h3>
                <p>Cliquez sur "Ajouter une question" pour commencer à créer votre quiz.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = quizData.questions.map((q, index) => `
        <div class="question-card" data-index="${index}">
            <div class="question-card-header">
                <span class="question-number">
                    <span>Q${index + 1}</span>
                    <span style="font-weight: normal; opacity: 0.7;">${getQuestionTypeLabel(q.type)}</span>
                </span>
                <div class="question-card-actions">
                    <button onclick="editQuestion(${index})" title="Modifier">✏️</button>
                    <button onclick="duplicateQuestion(${index})" title="Dupliquer">📋</button>
                    <button class="btn-delete" onclick="deleteQuestion(${index})" title="Supprimer">🗑️</button>
                </div>
            </div>
            <div class="question-text-preview">${escapeHtml(q.question)}</div>
            <div class="question-meta">
                <span>💬 ${q.answers.length} réponses</span>
                ${q.context ? '<span>📚 Contexte</span>' : ''}
                ${q.insight ? '<span>💡 Insight</span>' : ''}
            </div>
        </div>
    `).join('');
}

function getQuestionTypeLabel(type) {
    const labels = {
        'single': 'Choix unique',
        'multiple': 'Choix multiple',
        'profile': 'Profil'
    };
    return labels[type] || type;
}

function openQuestionModal(question = null, editIndex = -1) {
    document.getElementById('question-edit-index').value = editIndex;
    document.getElementById('question-modal-title').textContent = 
        editIndex >= 0 ? 'Modifier la question' : 'Nouvelle question';
    
    // Reset le modal
    document.querySelector('input[name="question-type"][value="single"]').checked = true;
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('active'));
    document.querySelector('.type-option:first-child').classList.add('active');
    
    document.getElementById('question-context-title').value = '';
    document.getElementById('question-context').value = '';
    document.getElementById('question-stat').value = '';
    document.getElementById('question-stat-source').value = '';
    document.getElementById('question-text').value = '';
    document.getElementById('question-insight').value = '';
    
    // Sections collapsées par défaut
    document.querySelectorAll('.section-content').forEach(el => el.classList.add('collapsed'));
    document.querySelectorAll('.section-header').forEach(el => el.classList.remove('open'));
    
    // Réponses par défaut
    const answersBuilder = document.getElementById('answers-builder');
    answersBuilder.innerHTML = '';
    
    if (question) {
        // Mode édition
        const typeRadio = document.querySelector(`input[name="question-type"][value="${question.type}"]`);
        if (typeRadio) {
            typeRadio.checked = true;
            document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('active'));
            typeRadio.closest('.type-option').classList.add('active');
        }
        
        document.getElementById('question-context-title').value = question.contextTitle || '';
        document.getElementById('question-context').value = question.context || '';
        document.getElementById('question-stat').value = question.stat || '';
        document.getElementById('question-stat-source').value = question.statSource || '';
        document.getElementById('question-text').value = question.question || '';
        document.getElementById('question-insight').value = question.insight || '';
        
        // Ouvrir les sections si elles ont du contenu
        if (question.context || question.contextTitle) {
            document.getElementById('context-section').classList.remove('collapsed');
            document.querySelector('[data-toggle="context-section"]').classList.add('open');
        }
        if (question.insight) {
            document.getElementById('feedback-section').classList.remove('collapsed');
            document.querySelector('[data-toggle="feedback-section"]').classList.add('open');
        }
        
        // Réponses
        question.answers.forEach((answer, i) => {
            addAnswer(answer, i);
        });
    } else {
        // Ajouter 4 réponses vides par défaut
        for (let i = 0; i < 4; i++) {
            addAnswer(null, i);
        }
    }
    
    document.getElementById('question-modal').classList.add('open');
}

function addAnswer(answer = null, index = null) {
    const builder = document.getElementById('answers-builder');
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const idx = index !== null ? index : builder.children.length;
    const letter = letters[idx] || (idx + 1).toString();
    
    const profileOptions = quizData.profiles.map(p => 
        `<option value="${p.code}" ${answer?.profileCode === p.code ? 'selected' : ''}>${p.emoji} ${p.name}</option>`
    ).join('');
    
    const html = `
        <div class="answer-item" data-index="${idx}">
            <div class="answer-header">
                <span class="answer-letter">${letter}</span>
                <input type="text" class="answer-text" placeholder="Texte de la réponse" value="${escapeHtml(answer?.text || '')}">
                <button class="btn-remove-answer" onclick="removeAnswer(this)" title="Supprimer">×</button>
            </div>
            <div class="answer-options">
                <div class="answer-option">
                    <input type="checkbox" id="correct-${idx}" ${answer?.isCorrect ? 'checked' : ''}>
                    <label for="correct-${idx}">✅ Réponse correcte</label>
                </div>
                <div class="answer-option">
                    <label>Profil associé:</label>
                    <select class="answer-profile">
                        <option value="">-- Aucun --</option>
                        ${profileOptions}
                    </select>
                </div>
            </div>
            <div class="answer-option" style="margin-bottom: 0.5rem;">
                <label style="width: 100%;">Label du profil (affiché)</label>
                <input type="text" class="answer-profile-label" placeholder="Ex: Profil Sécurité" value="${escapeHtml(answer?.profileLabel || '')}" style="flex: 1; padding: 0.4rem 0.6rem; border: 1px solid #ddd; border-radius: 6px;">
            </div>
            <div class="answer-feedback">
                <label>💡 Feedback si sélectionné (optionnel)</label>
                <textarea class="answer-feedback-text" placeholder="Explication affichée si l'utilisateur choisit cette réponse...">${escapeHtml(answer?.feedback || '')}</textarea>
            </div>
        </div>
    `;
    
    builder.insertAdjacentHTML('beforeend', html);
}

function removeAnswer(btn) {
    btn.closest('.answer-item').remove();
    // Réindexer les lettres
    const builder = document.getElementById('answers-builder');
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    builder.querySelectorAll('.answer-item').forEach((item, i) => {
        item.querySelector('.answer-letter').textContent = letters[i] || (i + 1).toString();
        item.dataset.index = i;
    });
}

function saveQuestion() {
    const editIndex = parseInt(document.getElementById('question-edit-index').value);
    const type = document.querySelector('input[name="question-type"]:checked').value;
    
    const question = {
        type: type,
        contextTitle: document.getElementById('question-context-title').value.trim(),
        context: document.getElementById('question-context').value.trim(),
        stat: document.getElementById('question-stat').value.trim(),
        statSource: document.getElementById('question-stat-source').value.trim(),
        question: document.getElementById('question-text').value.trim(),
        insight: document.getElementById('question-insight').value.trim(),
        answers: []
    };
    
    // Collecter les réponses
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    document.querySelectorAll('#answers-builder .answer-item').forEach((item, i) => {
        const text = item.querySelector('.answer-text').value.trim();
        if (text) {
            question.answers.push({
                text: text,
                isCorrect: item.querySelector('input[type="checkbox"]').checked,
                profileCode: item.querySelector('.answer-profile').value,
                profileLabel: item.querySelector('.answer-profile-label').value.trim(),
                feedback: item.querySelector('.answer-feedback-text').value.trim()
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
    
    if (editIndex >= 0) {
        quizData.questions[editIndex] = question;
    } else {
        quizData.questions.push(question);
    }
    
    closeQuestionModal();
    renderQuestions();
}

function closeQuestionModal() {
    document.getElementById('question-modal').classList.remove('open');
}

function editQuestion(index) {
    openQuestionModal(quizData.questions[index], index);
}

function deleteQuestion(index) {
    if (confirm('Supprimer cette question ?')) {
        quizData.questions.splice(index, 1);
        renderQuestions();
    }
}

function duplicateQuestion(index) {
    const original = quizData.questions[index];
    const copy = JSON.parse(JSON.stringify(original));
    delete copy.id;
    copy.answers.forEach(a => delete a.id);
    quizData.questions.splice(index + 1, 0, copy);
    renderQuestions();
}

// ============================================
// PROFILS
// ============================================

function renderProfiles() {
    const container = document.getElementById('profiles-container');
    
    if (quizData.profiles.length === 0) {
        container.innerHTML = '<p class="empty">Aucun profil défini.</p>';
        return;
    }
    
    container.innerHTML = quizData.profiles.map((p, index) => `
        <div class="profile-card" data-index="${index}">
            <div class="profile-header">
                <input type="color" class="profile-color" value="${p.color || '#2D5A3D'}" onchange="updateProfileColor(${index}, this.value)">
                <div class="profile-header-inputs">
                    <input type="text" value="${escapeHtml(p.emoji || '')}" placeholder="🎯" onchange="updateProfile(${index}, 'emoji', this.value)">
                    <input type="text" value="${escapeHtml(p.name || '')}" placeholder="Nom du profil" onchange="updateProfile(${index}, 'name', this.value)">
                </div>
                <button class="btn-remove-profile" onclick="removeProfile(${index})" title="Supprimer">×</button>
            </div>
            <div class="profile-body">
                <div class="form-group">
                    <label>Code (lettre)</label>
                    <input type="text" value="${escapeHtml(p.code || '')}" maxlength="1" placeholder="A" onchange="updateProfile(${index}, 'code', this.value.toUpperCase())">
                </div>
                <div class="form-group">
                    <label>Titre complet</label>
                    <input type="text" value="${escapeHtml(p.title || '')}" placeholder="Ex: Profil Sécurité Dominante" onchange="updateProfile(${index}, 'title', this.value)">
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Description</label>
                    <textarea rows="2" placeholder="Description du profil..." onchange="updateProfile(${index}, 'description', this.value)">${escapeHtml(p.description || '')}</textarea>
                </div>
                <div class="profile-lists">
                    <div class="form-group">
                        <label>Forces (une par ligne)</label>
                        <textarea rows="3" placeholder="Prudence développée&#10;Capacité d'anticipation" onchange="updateProfileList(${index}, 'forces', this.value)">${(p.forces || []).join('\n')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Points de vigilance (une par ligne)</label>
                        <textarea rows="3" placeholder="Difficulté à se projeter&#10;Tendance à retenir" onchange="updateProfileList(${index}, 'vigilances', this.value)">${(p.vigilances || []).join('\n')}</textarea>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function addProfile() {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const usedCodes = quizData.profiles.map(p => p.code);
    const nextCode = letters.find(l => !usedCodes.includes(l)) || (quizData.profiles.length + 1).toString();
    
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
    
    renderProfiles();
}

function removeProfile(index) {
    if (confirm('Supprimer ce profil ?')) {
        quizData.profiles.splice(index, 1);
        renderProfiles();
    }
}

function updateProfile(index, field, value) {
    quizData.profiles[index][field] = value;
}

function updateProfileColor(index, value) {
    quizData.profiles[index].color = value;
}

function updateProfileList(index, field, value) {
    quizData.profiles[index][field] = value.split('\n').filter(v => v.trim());
}

// ============================================
// SAUVEGARDE
// ============================================

async function saveQuiz() {
    const saveStatus = document.getElementById('save-status');
    saveStatus.textContent = 'Enregistrement...';
    saveStatus.className = 'save-status saving';
    
    try {
        // Collecter les données du formulaire
        const benefits = [];
        document.querySelectorAll('#benefits-list .benefit-input').forEach(input => {
            if (input.value.trim()) benefits.push(input.value.trim());
        });
        
        const conclusionNot = [];
        document.querySelectorAll('#conclusion-not-list input').forEach(input => {
            if (input.value.trim()) conclusionNot.push(input.value.trim());
        });
        
        const conclusionIs = [];
        document.querySelectorAll('#conclusion-is-list input').forEach(input => {
            if (input.value.trim()) conclusionIs.push(input.value.trim());
        });
        
        const quizPayload = {
            titre: document.getElementById('quiz-title').value.trim(),
            sous_titre: document.getElementById('quiz-subtitle').value.trim(),
            description: document.getElementById('quiz-description').value.trim(),
            intro_stat: document.getElementById('intro-stat').value.trim(),
            intro_stat_source: document.getElementById('intro-stat-source').value.trim(),
            intro_scientific: document.getElementById('intro-scientific').value.trim(),
            benefits: benefits,
            slug: document.getElementById('quiz-slug').value.trim(),
            duree: document.getElementById('quiz-duration').value.trim(),
            image_url: document.getElementById('quiz-image').value.trim(),
            published: document.getElementById('quiz-published').checked,
            collect_email: document.getElementById('quiz-collect-email').checked,
            show_progress: document.getElementById('quiz-show-progress').checked,
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
        
        let quizId = currentQuizId;
        
        if (currentQuizId) {
            // Update
            const { error } = await supabaseClient.from('quizzes').update(quizPayload).eq('id', currentQuizId);
            if (error) throw error;
        } else {
            // Insert
            const { data, error } = await supabaseClient.from('quizzes').insert(quizPayload).select().single();
            if (error) throw error;
            quizId = data.id;
            currentQuizId = quizId;
        }
        
        // Sauvegarder les profils
        await supabaseClient.from('quiz_profiles').delete().eq('quiz_id', quizId);
        
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
            await supabaseClient.from('quiz_profiles').insert(profilesPayload);
        }
        
        // Sauvegarder les questions
        await supabaseClient.from('quiz_questions').delete().eq('quiz_id', quizId);
        
        for (let i = 0; i < quizData.questions.length; i++) {
            const q = quizData.questions[i];
            
            const { data: questionData, error: qError } = await supabaseClient.from('quiz_questions').insert({
                quiz_id: quizId,
                numero: i + 1,
                type: q.type,
                context_title: q.contextTitle,
                context: q.context,
                stat: q.stat,
                stat_source: q.statSource,
                question: q.question,
                explication: q.insight
            }).select().single();
            
            if (qError) throw qError;
            
            // Sauvegarder les réponses
            if (q.answers.length > 0) {
                const answersPayload = q.answers.map((a, j) => ({
                    question_id: questionData.id,
                    code: quizData.profiles[j]?.code || ['A', 'B', 'C', 'D'][j] || (j + 1).toString(),
                    texte: a.text,
                    is_correct: a.isCorrect,
                    profil_label: a.profileLabel,
                    feedback: a.feedback,
                    ordre: j
                }));
                await supabaseClient.from('quiz_answers').insert(answersPayload);
            }
        }
        
        saveStatus.textContent = '✓ Enregistré';
        saveStatus.className = 'save-status saved';
        
        setTimeout(() => {
            saveStatus.textContent = '';
        }, 3000);
        
    } catch (error) {
        console.error('Erreur sauvegarde:', error);
        alert('Erreur lors de la sauvegarde: ' + error.message);
        saveStatus.textContent = 'Erreur';
        saveStatus.className = 'save-status';
    }
}

// ============================================
// ACTIONS
// ============================================

async function editQuiz(id) {
    const { data: quiz, error } = await supabaseClient
        .from('quizzes')
        .select('*')
        .eq('id', id)
        .single();
    
    if (quiz) {
        openEditor(quiz);
    }
}

function previewQuiz(slug) {
    window.open(`../quiz.html?quiz=${slug}`, '_blank');
}

function confirmDelete(id) {
    currentDeleteId = id;
    document.getElementById('delete-modal').classList.add('open');
}

async function deleteQuiz() {
    if (!currentDeleteId) return;
    
    try {
        await supabaseClient.from('quizzes').delete().eq('id', currentDeleteId);
        document.getElementById('delete-modal').classList.remove('open');
        currentDeleteId = null;
        loadQuizzes();
    } catch (error) {
        console.error('Erreur suppression:', error);
        alert('Erreur lors de la suppression');
    }
}

// ============================================
// UTILITAIRES
// ============================================

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
    
    // Retour
    document.getElementById('btn-back').addEventListener('click', () => {
        if (confirm('Quitter sans enregistrer ?')) {
            closeEditor();
            loadQuizzes();
        }
    });
    
    // Sauvegarder
    document.getElementById('btn-save').addEventListener('click', saveQuiz);
    
    // Aperçu
    document.getElementById('btn-preview').addEventListener('click', () => {
        const slug = document.getElementById('quiz-slug').value;
        if (slug) {
            previewQuiz(slug);
        } else {
            alert('Veuillez d\'abord définir un slug');
        }
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
        const list = document.getElementById('benefits-list');
        const html = `
            <div class="benefit-item">
                <span class="benefit-icon">✓</span>
                <input type="text" class="benefit-input" placeholder="Nouveau bénéfice...">
                <button class="btn-remove-benefit" title="Supprimer">×</button>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });
    
    // Supprimer bénéfice (délégation)
    document.getElementById('benefits-list').addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-benefit')) {
            e.target.closest('.benefit-item').remove();
        }
    });
    
    // Ajouter items conclusion
    document.querySelectorAll('.add-list-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const list = document.getElementById(targetId);
            const icon = targetId.includes('not') ? '❌' : '✅';
            const html = `
                <div class="list-item">
                    <span class="list-icon">${icon}</span>
                    <input type="text" placeholder="...">
                    <button class="btn-remove">×</button>
                </div>
            `;
            list.insertAdjacentHTML('beforeend', html);
        });
    });
    
    // Supprimer items conclusion (délégation)
    ['conclusion-not-list', 'conclusion-is-list'].forEach(id => {
        document.getElementById(id).addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-remove')) {
                e.target.closest('.list-item').remove();
            }
        });
    });
    
    // Questions
    document.getElementById('add-question-btn').addEventListener('click', () => openQuestionModal());
    document.getElementById('add-answer-btn').addEventListener('click', () => addAnswer());
    document.getElementById('question-save-btn').addEventListener('click', saveQuestion);
    document.getElementById('question-cancel-btn').addEventListener('click', closeQuestionModal);
    document.getElementById('question-modal-close').addEventListener('click', closeQuestionModal);
    document.querySelector('#question-modal .modal-overlay').addEventListener('click', closeQuestionModal);
    
    // Type de question
    document.querySelectorAll('input[name="question-type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('active'));
            radio.closest('.type-option').classList.add('active');
        });
    });
    
    // Sections collapsibles
    document.querySelectorAll('.section-header[data-toggle]').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.dataset.toggle;
            const content = document.getElementById(targetId);
            content.classList.toggle('collapsed');
            header.classList.toggle('open');
        });
    });
    
    // Profils
    document.getElementById('add-profile-btn').addEventListener('click', addProfile);
    
    // Auto-slug
    document.getElementById('quiz-title').addEventListener('input', (e) => {
        if (!currentQuizId) {
            const slug = e.target.value
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            document.getElementById('quiz-slug').value = slug;
            document.getElementById('slug-preview').textContent = slug || 'mon-quiz';
        }
    });
    
    document.getElementById('quiz-slug').addEventListener('input', (e) => {
        document.getElementById('slug-preview').textContent = e.target.value || 'mon-quiz';
    });
    
    // Delete modal
    document.getElementById('delete-modal-close').addEventListener('click', () => {
        document.getElementById('delete-modal').classList.remove('open');
    });
    document.getElementById('delete-cancel').addEventListener('click', () => {
        document.getElementById('delete-modal').classList.remove('open');
    });
    document.getElementById('delete-confirm').addEventListener('click', deleteQuiz);
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    });
}