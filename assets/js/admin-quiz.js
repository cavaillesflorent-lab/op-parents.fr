// ============================================
// ADMIN QUIZ - OP! Parents
// ============================================

// Initialiser Supabase
const client = initSupabase();

let currentQuizId = null;
let currentDeleteId = null;
let questionCounter = 0;

// Auth check
client.auth.onAuthStateChange((event, session) => {
    if (!session) {
        window.location.href = 'login.html';
    } else {
        loadQuizzes();
    }
});

// ============================================
// CHARGEMENT DES QUIZ
// ============================================

async function loadQuizzes() {
    const { data: quizzes, error } = await supabaseClient
        .from('quizzes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erreur:', error);
        return;
    }

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
                <br><small class="text-muted">/quiz.html?quiz=${quiz.slug}</small>
            </td>
            <td>${questionCounts[quiz.id] || 0}</td>
            <td>${resultCounts[quiz.id] || 0}</td>
            <td>
                <span class="status-badge ${quiz.published ? 'status-published' : 'status-draft'}">
                    ${quiz.published ? 'Publié' : 'Brouillon'}
                </span>
            </td>
            <td class="actions-cell">
                <button class="btn-icon" onclick="editQuiz('${quiz.id}')" title="Modifier">✏️</button>
                <button class="btn-icon" onclick="previewQuiz('${quiz.slug}')" title="Aperçu">👁️</button>
                <button class="btn-icon btn-danger" onclick="confirmDelete('${quiz.id}')" title="Supprimer">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// ============================================
// MODAL QUIZ
// ============================================

function openModal(quiz = null) {
    currentQuizId = quiz?.id || null;
    questionCounter = 0;
    
    document.getElementById('modal-title').textContent = quiz ? 'Modifier le quiz' : 'Nouveau quiz';
    document.getElementById('quiz-id').value = quiz?.id || '';
    
    // Reset form
    document.getElementById('titre').value = quiz?.titre || '';
    document.getElementById('slug').value = quiz?.slug || '';
    document.getElementById('description').value = quiz?.description || '';
    document.getElementById('intro_stat').value = quiz?.intro_stat || '';
    document.getElementById('intro_stat_source').value = quiz?.intro_stat_source || '';
    document.getElementById('published').checked = quiz?.published || false;
    
    // Reset questions
    document.getElementById('questions-list').innerHTML = 
        '<p class="empty-message">Aucune question. Cliquez sur "Ajouter une question" pour commencer.</p>';
    
    // Reset profiles
    document.querySelectorAll('.profile-editor').forEach(el => {
        el.querySelector('.profile-nom').value = '';
        el.querySelector('.profile-emoji').value = '';
        el.querySelector('.profile-titre').value = '';
        el.querySelector('.profile-description').value = '';
        el.querySelector('.profile-forces').value = '';
        el.querySelector('.profile-vigilances').value = '';
    });
    
    // Reset tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelector('[data-tab="general"]').classList.add('active');
    document.getElementById('tab-general').classList.add('active');
    
    // Si édition, charger les données
    if (quiz) {
        loadQuizDetails(quiz.id);
    }
    
    document.getElementById('quiz-modal').classList.add('open');
}

async function loadQuizDetails(quizId) {
    // Charger les questions
    const { data: questions } = await supabaseClient
        .from('quiz_questions')
        .select(`*, quiz_answers(*)`)
        .eq('quiz_id', quizId)
        .order('numero');
    
    if (questions) {
        document.getElementById('questions-list').innerHTML = '';
        questions.forEach(q => {
            addQuestion(q);
        });
    }
    
    // Charger les profils
    const { data: profiles } = await supabaseClient
        .from('quiz_profiles')
        .select('*')
        .eq('quiz_id', quizId);
    
    if (profiles) {
        profiles.forEach(p => {
            const el = document.querySelector(`.profile-editor[data-code="${p.code}"]`);
            if (el) {
                el.querySelector('.profile-nom').value = p.nom || '';
                el.querySelector('.profile-emoji').value = p.emoji || '';
                el.querySelector('.profile-titre').value = p.titre || '';
                el.querySelector('.profile-description').value = p.description || '';
                el.querySelector('.profile-forces').value = (p.forces || []).join('\n');
                el.querySelector('.profile-vigilances').value = (p.vigilances || []).join('\n');
            }
        });
    }
}

function closeModal() {
    document.getElementById('quiz-modal').classList.remove('open');
    currentQuizId = null;
}

// ============================================
// GESTION DES QUESTIONS
// ============================================

function addQuestion(data = null) {
    const template = document.getElementById('question-template');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.question-card');
    
    questionCounter++;
    card.dataset.index = questionCounter;
    card.dataset.id = data?.id || '';
    card.querySelector('.question-number').textContent = `Question ${questionCounter}`;
    
    if (data) {
        card.querySelector('.question-text').value = data.question || '';
        card.querySelector('.question-insight').value = data.explication || '';
        
        // Remplir les réponses
        const answers = data.quiz_answers || [];
        ['A', 'B', 'C', 'D'].forEach(code => {
            const answer = answers.find(a => a.code === code);
            const row = card.querySelectorAll('.answer-row')[['A', 'B', 'C', 'D'].indexOf(code)];
            if (answer && row) {
                row.querySelector('.answer-text').value = answer.texte || '';
                row.querySelector('.answer-label').value = answer.profil_label || '';
            }
        });
    }
    
    // Bind delete
    card.querySelector('.delete-question').addEventListener('click', () => {
        card.remove();
        updateQuestionNumbers();
    });
    
    // Remove empty message
    const emptyMsg = document.querySelector('#questions-list .empty-message');
    if (emptyMsg) emptyMsg.remove();
    
    document.getElementById('questions-list').appendChild(card);
}

function updateQuestionNumbers() {
    const cards = document.querySelectorAll('.question-card');
    cards.forEach((card, index) => {
        card.querySelector('.question-number').textContent = `Question ${index + 1}`;
    });
}

// ============================================
// SAUVEGARDE
// ============================================

async function saveQuiz(e) {
    e.preventDefault();
    
    const btnText = document.querySelector('.btn-text');
    const btnLoader = document.querySelector('.btn-loader');
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline';
    
    try {
        // Données du quiz
        const quizData = {
            titre: document.getElementById('titre').value,
            slug: document.getElementById('slug').value,
            description: document.getElementById('description').value,
            intro_stat: document.getElementById('intro_stat').value,
            intro_stat_source: document.getElementById('intro_stat_source').value,
            published: document.getElementById('published').checked
        };
        
        let quizId = currentQuizId;
        
        if (currentQuizId) {
            // Update
            await supabaseClient.from('quizzes').update(quizData).eq('id', currentQuizId);
        } else {
            // Insert
            const { data } = await supabaseClient.from('quizzes').insert(quizData).select().single();
            quizId = data.id;
        }
        
        // Sauvegarder les profils
        await saveProfiles(quizId);
        
        // Sauvegarder les questions
        await saveQuestions(quizId);
        
        closeModal();
        loadQuizzes();
        
    } catch (error) {
        console.error('Erreur sauvegarde:', error);
        alert('Erreur lors de la sauvegarde');
    } finally {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

async function saveProfiles(quizId) {
    // Supprimer les anciens profils
    await supabaseClient.from('quiz_profiles').delete().eq('quiz_id', quizId);
    
    // Insérer les nouveaux
    const profiles = [];
    document.querySelectorAll('.profile-editor').forEach(el => {
        const nom = el.querySelector('.profile-nom').value.trim();
        if (nom) {
            profiles.push({
                quiz_id: quizId,
                code: el.dataset.code,
                nom: nom,
                emoji: el.querySelector('.profile-emoji').value.trim(),
                titre: el.querySelector('.profile-titre').value.trim(),
                description: el.querySelector('.profile-description').value.trim(),
                forces: el.querySelector('.profile-forces').value.split('\n').filter(f => f.trim()),
                vigilances: el.querySelector('.profile-vigilances').value.split('\n').filter(v => v.trim())
            });
        }
    });
    
    if (profiles.length > 0) {
        await supabaseClient.from('quiz_profiles').insert(profiles);
    }
}

async function saveQuestions(quizId) {
    // Supprimer les anciennes questions et réponses
    await supabaseClient.from('quiz_questions').delete().eq('quiz_id', quizId);
    
    // Insérer les nouvelles
    const questionCards = document.querySelectorAll('.question-card');
    
    for (let i = 0; i < questionCards.length; i++) {
        const card = questionCards[i];
        const questionText = card.querySelector('.question-text').value.trim();
        
        if (!questionText) continue;
        
        // Insérer la question
        const { data: question } = await supabaseClient.from('quiz_questions').insert({
            quiz_id: quizId,
            numero: i + 1,
            question: questionText,
            explication: card.querySelector('.question-insight').value.trim()
        }).select().single();
        
        // Insérer les réponses
        const answers = [];
        card.querySelectorAll('.answer-row').forEach((row, idx) => {
            const code = ['A', 'B', 'C', 'D'][idx];
            const texte = row.querySelector('.answer-text').value.trim();
            if (texte) {
                answers.push({
                    question_id: question.id,
                    code: code,
                    texte: texte,
                    profil_label: row.querySelector('.answer-label').value.trim(),
                    ordre: idx
                });
            }
        });
        
        if (answers.length > 0) {
            await supabaseClient.from('quiz_answers').insert(answers);
        }
    }
}

// ============================================
// ACTIONS
// ============================================

async function editQuiz(id) {
    const { data: quiz } = await supabaseClient
        .from('quizzes')
        .select('*')
        .eq('id', id)
        .single();
    
    if (quiz) {
        openModal(quiz);
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
    
    await supabaseClient.from('quizzes').delete().eq('id', currentDeleteId);
    
    document.getElementById('delete-modal').classList.remove('open');
    currentDeleteId = null;
    loadQuizzes();
}

// ============================================
// EVENTS
// ============================================

// Nouveau quiz
document.getElementById('new-quiz-btn').addEventListener('click', () => openModal());

// Fermer modal
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('cancel-btn').addEventListener('click', closeModal);
document.querySelector('#quiz-modal .modal-overlay').addEventListener('click', closeModal);

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

// Ajouter question
document.getElementById('add-question-btn').addEventListener('click', () => addQuestion());

// Submit form
document.getElementById('quiz-form').addEventListener('submit', saveQuiz);

// Auto-generate slug
document.getElementById('titre').addEventListener('input', (e) => {
    if (!currentQuizId) {
        const slug = e.target.value
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        document.getElementById('slug').value = slug;
    }
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