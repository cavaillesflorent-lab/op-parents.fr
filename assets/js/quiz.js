// ============================================
// QUIZ ENGINE - OP! Parents
// ============================================

class QuizEngine {
    constructor() {
        this.quiz = null;
        this.questions = [];
        this.profiles = [];
        this.currentIndex = 0;
        this.answers = {};
        this.scores = { A: 0, B: 0, C: 0, D: 0 };
        this.sessionId = this.generateSessionId();
    }

    // Générer un ID de session unique
    generateSessionId() {
        return 'quiz_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Initialiser le quiz
    async init(quizSlug = null) {
        try {
            // Récupérer le slug depuis l'URL ou utiliser celui par défaut
            const urlParams = new URLSearchParams(window.location.search);
            const slug = quizSlug || urlParams.get('quiz') || 'mindset-financier';

            await this.loadQuiz(slug);
            this.bindEvents();
            this.showIntro();
        } catch (error) {
            console.error('Erreur initialisation quiz:', error);
            this.showError('Impossible de charger le quiz. Veuillez réessayer.');
        }
    }

    // Charger le quiz depuis Supabase
    async loadQuiz(slug) {
        // Charger le quiz
        const { data: quiz, error: quizError } = await supabaseClient
            .from('quizzes')
            .select('*')
            .eq('slug', slug)
            .eq('published', true)
            .single();

        if (quizError || !quiz) {
            throw new Error('Quiz non trouvé');
        }

        this.quiz = quiz;

        // Charger les profils
        const { data: profiles } = await supabaseClient
            .from('quiz_profiles')
            .select('*')
            .eq('quiz_id', quiz.id)
            .order('code');

        this.profiles = profiles || [];

        // Charger les séquences
        const { data: sequences } = await supabaseClient
            .from('quiz_sequences')
            .select('*')
            .eq('quiz_id', quiz.id)
            .order('numero');

        // Charger les questions
        const { data: questions } = await supabaseClient
            .from('quiz_questions')
            .select(`
                *,
                quiz_answers (*)
            `)
            .eq('quiz_id', quiz.id)
            .order('numero');

        // Associer les séquences aux questions
        this.questions = (questions || []).map(q => {
            const sequence = (sequences || []).find(s => s.id === q.sequence_id);
            return {
                ...q,
                sequence: sequence,
                answers: (q.quiz_answers || []).sort((a, b) => a.ordre - b.ordre)
            };
        });

        console.log('Quiz chargé:', this.quiz.titre, '- Questions:', this.questions.length);
    }

    // Afficher l'écran d'accueil
    showIntro() {
        document.getElementById('quiz-loading').style.display = 'none';
        document.getElementById('quiz-intro').style.display = 'block';
        document.getElementById('quiz-question-screen').style.display = 'none';
        document.getElementById('quiz-result-screen').style.display = 'none';

        // Remplir les infos
        document.getElementById('quiz-title').textContent = this.quiz.titre;
        document.getElementById('quiz-description').textContent = this.quiz.description || '';
        
        if (this.quiz.intro_stat) {
            document.getElementById('stat-number').textContent = this.quiz.intro_stat;
            document.getElementById('stat-source').textContent = this.quiz.intro_stat_source || '';
            document.getElementById('quiz-stat').style.display = 'block';
        }

        document.getElementById('quiz-questions-count').textContent = this.questions.length;
        document.getElementById('quiz-duration').textContent = Math.ceil(this.questions.length * 0.5) + ' min';
    }

    // Démarrer le quiz
    start() {
        this.currentIndex = 0;
        this.answers = {};
        this.scores = { A: 0, B: 0, C: 0, D: 0 };
        
        document.getElementById('quiz-intro').style.display = 'none';
        document.getElementById('quiz-question-screen').style.display = 'block';
        
        this.showQuestion();
    }

    // Afficher une question
    showQuestion() {
        const question = this.questions[this.currentIndex];
        if (!question) {
            this.showResult();
            return;
        }

        // Progress
        const progress = ((this.currentIndex) / this.questions.length) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
        document.getElementById('progress-text').textContent = 
            `Question ${this.currentIndex + 1}/${this.questions.length}`;

        // Context (séquence)
        const contextEl = document.getElementById('quiz-context');
        if (question.sequence && question.sequence.contexte) {
            document.getElementById('context-badge').textContent = 
                `🔁 ${question.sequence.titre}`;
            document.getElementById('context-text').textContent = question.sequence.contexte;
            contextEl.style.display = 'block';
        } else {
            contextEl.style.display = 'none';
        }

        // Stat highlight
        const statEl = document.getElementById('quiz-stat-highlight');
        if (question.sequence && question.sequence.stat_texte) {
            document.getElementById('highlight-stat-text').textContent = question.sequence.stat_texte;
            document.getElementById('highlight-stat-source').textContent = 
                question.sequence.stat_source || '';
            statEl.style.display = 'flex';
        } else {
            statEl.style.display = 'none';
        }

        // Question
        document.getElementById('quiz-question').textContent = question.question;

        // Answers
        const answersContainer = document.getElementById('quiz-answers');
        answersContainer.innerHTML = question.answers.map(answer => `
            <button class="quiz-answer" data-code="${answer.code}" data-question="${question.id}">
                <span class="answer-letter">${answer.code}</span>
                <span class="answer-text">${answer.texte}</span>
                <span class="answer-profile">${answer.profil_label || ''}</span>
            </button>
        `).join('');

        // Bind answer clicks
        answersContainer.querySelectorAll('.quiz-answer').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectAnswer(e.currentTarget));
        });

        // Hide insight
        document.getElementById('quiz-insight').style.display = 'none';

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Sélectionner une réponse
    selectAnswer(button) {
        const code = button.dataset.code;
        const questionId = button.dataset.question;

        // Visual feedback
        document.querySelectorAll('.quiz-answer').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');

        // Save answer
        this.answers[questionId] = code;
        this.scores[code]++;

        // Show insight
        const question = this.questions[this.currentIndex];
        const insightEl = document.getElementById('quiz-insight');
        
        if (question.explication || (question.sequence && question.sequence.insight)) {
            document.getElementById('insight-text').textContent = 
                question.explication || question.sequence.insight;
            insightEl.style.display = 'flex';
        } else {
            // Auto next after delay
            setTimeout(() => this.nextQuestion(), 800);
        }
    }

    // Question suivante
    nextQuestion() {
        this.currentIndex++;
        
        if (this.currentIndex >= this.questions.length) {
            this.showResult();
        } else {
            // Animation de transition
            const container = document.querySelector('.quiz-question-container');
            container.style.opacity = '0';
            container.style.transform = 'translateX(-20px)';
            
            setTimeout(() => {
                this.showQuestion();
                container.style.opacity = '1';
                container.style.transform = 'translateX(0)';
            }, 300);
        }
    }

    // Calculer et afficher le résultat
    showResult() {
        // Trouver le profil dominant
        const dominant = Object.entries(this.scores)
            .sort((a, b) => b[1] - a[1])[0][0];

        const profile = this.profiles.find(p => p.code === dominant) || this.getDefaultProfile(dominant);

        // Afficher l'écran de résultat
        document.getElementById('quiz-question-screen').style.display = 'none';
        document.getElementById('quiz-result-screen').style.display = 'block';

        // Remplir les infos du profil
        document.getElementById('result-icon').textContent = profile.emoji || '🎯';
        document.getElementById('result-icon').className = `result-profile-icon profile-${dominant.toLowerCase()}`;
        document.getElementById('result-profile-name').textContent = profile.nom || profile.titre;
        document.getElementById('result-profile-subtitle').textContent = profile.titre;
        document.getElementById('result-description-text').textContent = profile.description || '';

        // Forces
        const forcesList = document.getElementById('result-forces-list');
        forcesList.innerHTML = (profile.forces || []).map(f => `<li>• ${f}</li>`).join('');

        // Vigilances
        const vigilancesList = document.getElementById('result-vigilances-list');
        vigilancesList.innerHTML = (profile.vigilances || []).map(v => `<li>• ${v}</li>`).join('');

        // Graphique radar
        this.renderRadarChart();

        // Sauvegarder le résultat
        this.saveResult(dominant);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Profil par défaut si non trouvé en DB
    getDefaultProfile(code) {
        const defaults = {
            A: {
                code: 'A',
                emoji: '🔒',
                nom: 'Sécurité Dominante',
                titre: 'Profil Sécurité',
                description: "L'argent est avant tout un bouclier contre l'imprévu, le stress, la perte de contrôle. Il est lié au soulagement plus qu'au plaisir.",
                forces: ['Prudence développée', 'Capacité d\'anticipation', 'Sens des responsabilités'],
                vigilances: ['Difficulté à se projeter positivement', 'Tendance à retenir plutôt qu\'à choisir', 'Risque de vivre dans l\'attente permanente']
            },
            B: {
                code: 'B',
                emoji: '🛡️',
                nom: 'Prudence / Contrôle',
                titre: 'Profil Prudence',
                description: "L'argent est un système à maîtriser. Tu cherches à éviter les erreurs, réduire les risques, garder la main.",
                forces: ['Organisation solide', 'Rigueur appréciable', 'Sens du cadre'],
                vigilances: ['Sur-contrôle possible', 'Charge mentale élevée', 'Difficulté à lâcher prise']
            },
            C: {
                code: 'C',
                emoji: '⚖️',
                nom: 'Équilibre / Rationalité',
                titre: 'Profil Équilibre',
                description: "Tu vois l'argent comme un outil fonctionnel. Ni trop émotionnel, ni totalement détaché.",
                forces: ['Capacité d\'analyse', 'Décisions posées', 'Vision structurée'],
                vigilances: ['Peu de lien au plaisir', 'Tendance à intellectualiser', 'Difficulté à écouter l\'émotion']
            },
            D: {
                code: 'D',
                emoji: '🕊️',
                nom: 'Liberté / Alignement',
                titre: 'Profil Liberté',
                description: "L'argent est un levier de choix : choix de vie, de temps, d'alignement.",
                forces: ['Vision claire', 'Capacité à investir en toi', 'Projection long terme'],
                vigilances: ['Sous-estimation des contraintes', 'Besoin de sécuriser sans s\'enfermer', 'Risque de déconnexion du cadre']
            }
        };
        return defaults[code] || defaults.A;
    }

    // Graphique radar
    renderRadarChart() {
        const ctx = document.getElementById('result-radar-chart');
        if (!ctx) return;

        const total = Object.values(this.scores).reduce((a, b) => a + b, 0);
        const data = {
            labels: ['Sécurité', 'Prudence', 'Équilibre', 'Liberté'],
            datasets: [{
                label: 'Ton profil',
                data: [
                    (this.scores.A / total) * 100,
                    (this.scores.B / total) * 100,
                    (this.scores.C / total) * 100,
                    (this.scores.D / total) * 100
                ],
                backgroundColor: 'rgba(45, 90, 61, 0.2)',
                borderColor: 'rgba(45, 90, 61, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(45, 90, 61, 1)'
            }]
        };

        new Chart(ctx, {
            type: 'radar',
            data: data,
            options: {
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Sauvegarder le résultat en DB
    async saveResult(dominant) {
        try {
            await supabaseClient.from('quiz_results').insert({
                quiz_id: this.quiz.id,
                session_id: this.sessionId,
                profil_dominant: dominant,
                scores: this.scores,
                reponses: this.answers
            });
            console.log('Résultat sauvegardé');
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
        }
    }

    // Partager le résultat
    share() {
        const dominant = Object.entries(this.scores).sort((a, b) => b[1] - a[1])[0][0];
        const profile = this.profiles.find(p => p.code === dominant) || this.getDefaultProfile(dominant);
        
        const text = `Je viens de découvrir mon profil financier : ${profile.nom} ${profile.emoji}! Et toi, quel est ton mindset par rapport à l'argent ?`;
        const url = window.location.href;

        if (navigator.share) {
            navigator.share({ title: 'Mon profil financier - OP!', text, url });
        } else {
            // Fallback: copier dans le presse-papier
            navigator.clipboard.writeText(`${text}\n${url}`);
            alert('Lien copié dans le presse-papier !');
        }
    }

    // Recommencer
    restart() {
        this.currentIndex = 0;
        this.answers = {};
        this.scores = { A: 0, B: 0, C: 0, D: 0 };
        this.sessionId = this.generateSessionId();
        this.showIntro();
    }

    // Afficher une erreur
    showError(message) {
        document.getElementById('quiz-loading').innerHTML = `
            <p class="error">${message}</p>
            <a href="index.html" class="btn btn-primary">Retour à l'accueil</a>
        `;
    }

    // Bind events
    bindEvents() {
        document.getElementById('btn-start').addEventListener('click', () => this.start());
        document.getElementById('btn-next').addEventListener('click', () => this.nextQuestion());
        document.getElementById('btn-share').addEventListener('click', () => this.share());
        document.getElementById('btn-restart').addEventListener('click', () => this.restart());

        // Email form
        document.getElementById('email-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('result-email').value;
            if (email) {
                // Mettre à jour le résultat avec l'email
                await supabaseClient.from('quiz_results')
                    .update({ email })
                    .eq('session_id', this.sessionId);
                alert('Merci ! Tu recevras ton profil complet par email.');
            }
        });
    }
}

// ============================================
// INITIALISATION
// ============================================

document.addEventListener('componentsLoaded', () => {
    initSupabase();
    const quiz = new QuizEngine();
    quiz.init();
});

// Si les composants ne se chargent pas (page standalone)
setTimeout(() => {
    if (typeof supabaseClient === 'undefined' || supabaseClient === null) {
        initSupabase();
        const quiz = new QuizEngine();
        quiz.init();
    }
}, 1000);