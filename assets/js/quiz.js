// ============================================
// QUIZ ENGINE - OP! Parents
// Navigation par séquence avec sommaire
// ============================================

const STORAGE_KEY = 'op_quiz_progress';

class QuizEngine {
    constructor() {
        this.quiz = null;
        this.quizSlug = null;
        this.sequences = [];
        this.profiles = [];
        this.currentSequenceIndex = -1;
        this.currentQuestionIndex = 0;
        this.sequenceProgress = {}; // { seq_id: { answers: {}, scores: {A,B,C,D}, completed: bool, currentIndex: 0 } }
        this.sessionId = this.generateSessionId();
    }

    generateSessionId() {
        return 'quiz_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ============================================
    // GESTION DE LA PROGRESSION (localStorage)
    // ============================================

    getAllProgress() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    }

    getProgress() {
        return this.getAllProgress()[this.quizSlug] || null;
    }

    saveProgress() {
        const allProgress = this.getAllProgress();
        
        // Calculer le nombre total de réponses pour compatibilité avec quizzes.html
        let totalAnswered = 0;
        let totalQuestions = 0;
        this.sequences.forEach(seq => {
            const seqProgress = this.sequenceProgress[seq.id];
            if (seqProgress && seqProgress.answers) {
                totalAnswered += Object.keys(seqProgress.answers).length;
            }
            totalQuestions += seq.questions.length;
        });
        
        allProgress[this.quizSlug] = {
            sequenceProgress: this.sequenceProgress,
            completed: this.isQuizCompleted(),
            updatedAt: new Date().toISOString(),
            // Champs pour compatibilité avec quizzes.html
            answeredQuestions: totalAnswered,
            totalQuestions: totalQuestions
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
    }

    loadSavedProgress() {
        const saved = this.getProgress();
        if (saved && saved.sequenceProgress) {
            this.sequenceProgress = saved.sequenceProgress;
            return true;
        }
        return false;
    }

    clearProgress() {
        const allProgress = this.getAllProgress();
        delete allProgress[this.quizSlug];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
        this.sequenceProgress = {};
    }

    isQuizCompleted() {
        return this.sequences.every(seq => this.sequenceProgress[seq.id]?.completed);
    }

    markCompleted(dominantProfile) {
        const allProgress = this.getAllProgress();
        allProgress[this.quizSlug] = {
            ...allProgress[this.quizSlug],
            completed: true,
            dominantProfile: dominantProfile,
            completedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
    }

    // ============================================
    // INITIALISATION
    // ============================================

    async init(slug, isPreview = false) {
        this.quizSlug = slug;
        this.isPreview = isPreview;
        console.log('Quiz init:', slug, 'preview:', isPreview);

        try {
            await this.loadQuiz(slug);
            console.log('Quiz chargé, séquences:', this.sequences.length);
            this.loadSavedProgress();
            this.initializeSequenceProgress();
            this.showIntro();
            this.bindEvents();
            console.log('Init terminé avec succès');
        } catch (error) {
            console.error('Erreur initialisation quiz:', error);
            this.showError(error.message);
        }
    }

    async loadQuiz(slug) {
        let query = supabaseClient
            .from('quizzes')
            .select('*')
            .eq('slug', slug);

        if (!this.isPreview) {
            query = query.eq('published', true);
        }

        const { data: quiz, error: quizError } = await query.single();

        if (quizError || !quiz) {
            throw new Error('Quiz non trouvé');
        }

        this.quiz = quiz;

        // Charger les profils globaux
        const { data: profiles } = await supabaseClient
            .from('quiz_profiles')
            .select('*')
            .eq('quiz_id', quiz.id)
            .order('code');

        this.profiles = profiles || [];

        // Charger les séquences avec leurs questions
        const { data: sequences } = await supabaseClient
            .from('quiz_sequences')
            .select('*')
            .eq('quiz_id', quiz.id)
            .order('numero');

        this.sequences = [];

        for (const seq of (sequences || [])) {
            const { data: questions } = await supabaseClient
                .from('quiz_questions')
                .select('*, quiz_answers(*)')
                .eq('sequence_id', seq.id)
                .order('numero');

            console.log(`Séquence "${seq.titre}": ${(questions || []).length} questions chargées`);

            this.sequences.push({
                ...seq,
                questions: (questions || []).map(q => ({
                    ...q,
                    answers: (q.quiz_answers || []).sort((a, b) => a.ordre - b.ordre)
                }))
            });
        }

        console.log('Quiz chargé:', this.quiz.titre, '- Séquences:', this.sequences.length);
        this.sequences.forEach((seq, i) => {
            console.log(`  Séquence ${i}: "${seq.titre}" - ${seq.questions.length} questions`);
        });
    }

    initializeSequenceProgress() {
        this.sequences.forEach(seq => {
            if (!this.sequenceProgress[seq.id]) {
                this.sequenceProgress[seq.id] = {
                    answers: {},
                    scores: { A: 0, B: 0, C: 0, D: 0 },
                    completed: false,
                    currentIndex: 0
                };
            }
        });
    }

    // ============================================
    // ÉCRANS
    // ============================================

    showIntro() {
        this.hideAllScreens();
        document.getElementById('quiz-intro').style.display = 'block';

        const titleEl = document.getElementById('quiz-title');
        const descEl = document.getElementById('quiz-description');
        
        if (titleEl) titleEl.textContent = this.quiz.titre;
        if (descEl) descEl.textContent = this.quiz.description || this.quiz.sous_titre || '';

        // Image de couverture
        const coverImg = document.getElementById('quiz-cover-image');
        const coverPlaceholder = document.getElementById('quiz-cover-placeholder');
        if (coverImg && this.quiz.image_url) {
            coverImg.src = this.quiz.image_url;
            coverImg.style.display = 'block';
            if (coverPlaceholder) coverPlaceholder.style.display = 'none';
        }

        // Stats
        const statEl = document.getElementById('quiz-stat');
        const statNumber = document.getElementById('stat-number');
        const statSource = document.getElementById('stat-source');
        if (this.quiz.intro_stat && statNumber) {
            statNumber.textContent = this.quiz.intro_stat;
            if (statSource) statSource.textContent = this.quiz.intro_stat_source || '';
            if (statEl) statEl.style.display = 'block';
        } else if (statEl) {
            statEl.style.display = 'none';
        }

        // Bénéfices
        const benefitsList = document.getElementById('benefits-list');
        const benefitsContainer = document.getElementById('quiz-benefits');
        if (benefitsList && this.quiz.benefits && this.quiz.benefits.length > 0) {
            benefitsList.innerHTML = this.quiz.benefits.map(benefit => `<li>${benefit}</li>`).join('');
            if (benefitsContainer) benefitsContainer.style.display = 'block';
        } else if (benefitsContainer) {
            benefitsContainer.style.display = 'none';
        }

        // Nombre de questions total
        const totalQuestions = this.sequences.reduce((sum, seq) => sum + seq.questions.length, 0);
        const questionsCountEl = document.getElementById('quiz-questions-count');
        const durationEl = document.getElementById('quiz-duration');
        if (questionsCountEl) questionsCountEl.textContent = totalQuestions;
        if (durationEl) durationEl.textContent = this.quiz.duree || Math.ceil(totalQuestions * 0.5) + ' min';

        // Vérifier s'il y a une progression
        const hasProgress = Object.values(this.sequenceProgress).some(p => Object.keys(p.answers).length > 0);
        const resumeBlock = document.getElementById('quiz-resume-block');
        const startBtn = document.getElementById('btn-start');
        const resumeBtn = document.getElementById('btn-resume');
        const restartFreshBtn = document.getElementById('btn-restart-fresh');

        if (hasProgress) {
            if (resumeBlock) resumeBlock.style.display = 'block';
            if (startBtn) startBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'flex';
            if (restartFreshBtn) restartFreshBtn.style.display = 'block';
        } else {
            if (resumeBlock) resumeBlock.style.display = 'none';
            if (startBtn) startBtn.style.display = 'flex';
            if (resumeBtn) resumeBtn.style.display = 'none';
            if (restartFreshBtn) restartFreshBtn.style.display = 'none';
        }
    }

    showSummary() {
        this.hideAllScreens();
        
        let summaryScreen = document.getElementById('quiz-summary');
        if (!summaryScreen) {
            summaryScreen = document.createElement('div');
            summaryScreen.id = 'quiz-summary';
            summaryScreen.className = 'quiz-summary';
            const container = document.querySelector('.quiz-main');
            if (container) {
                container.appendChild(summaryScreen);
            } else {
                document.body.appendChild(summaryScreen);
            }
        }

        const completedCount = this.sequences.filter(seq => this.sequenceProgress[seq.id]?.completed).length;
        const allCompleted = completedCount === this.sequences.length;

        summaryScreen.innerHTML = `
            <div class="summary-content">
                <div class="summary-header">
                    <h2>${this.quiz.titre}</h2>
                    <p class="summary-progress-text">${completedCount} / ${this.sequences.length} séquences complétées</p>
                    <div class="summary-progress-bar">
                        <div class="summary-progress-fill" style="width: ${(completedCount / this.sequences.length) * 100}%"></div>
                    </div>
                </div>

                <div class="summary-sequences">
                    ${this.sequences.map((seq, index) => this.renderSequenceCard(seq, index)).join('')}
                </div>

                ${allCompleted ? `
                    <button class="btn-see-results" id="btn-see-results">
                        Voir mon bilan final
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </button>
                ` : ''}
            </div>
        `;

        summaryScreen.style.display = 'block';

        // Bind events
        summaryScreen.querySelectorAll('.sequence-card-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const seqIndex = parseInt(e.currentTarget.dataset.index);
                this.startSequence(seqIndex);
            });
        });

        if (allCompleted) {
            document.getElementById('btn-see-results').addEventListener('click', () => {
                this.showFinalResult();
            });
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    renderSequenceCard(seq, index) {
        const progress = this.sequenceProgress[seq.id] || {};
        const isCompleted = progress.completed;
        const answeredCount = Object.keys(progress.answers || {}).length;
        const totalQuestions = seq.questions.length;
        const percent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
        
        // Première séquence non complétée = active
        const firstIncomplete = this.sequences.findIndex(s => !this.sequenceProgress[s.id]?.completed);
        const isActive = index === firstIncomplete;
        const isLocked = index > firstIncomplete && firstIncomplete !== -1;

        // Calculer le profil dominant si complété
        let bilanText = '';
        if (isCompleted && progress.scores) {
            const dominant = this.getDominantProfile(progress.scores, seq);
            if (dominant) {
                bilanText = `<span class="sequence-bilan-mini">${dominant.name}</span>`;
            }
        }

        let statusIcon = '⚪';
        let statusClass = 'locked';
        let buttonHtml = '<span class="sequence-locked">🔒 Verrouillé</span>';

        if (isCompleted) {
            statusIcon = '✅';
            statusClass = 'completed';
            buttonHtml = `<button class="sequence-card-btn refaire" data-index="${index}">Refaire</button>`;
        } else if (isActive || answeredCount > 0) {
            statusIcon = '🔵';
            statusClass = 'active';
            buttonHtml = answeredCount > 0 
                ? `<button class="sequence-card-btn" data-index="${index}">Continuer →</button>`
                : `<button class="sequence-card-btn" data-index="${index}">Commencer →</button>`;
        }

        return `
            <div class="sequence-summary-card ${statusClass}">
                <div class="sequence-card-header">
                    <span class="sequence-status-icon">${statusIcon}</span>
                    <div class="sequence-card-info">
                        <span class="sequence-numero">Séquence ${index + 1}</span>
                        <h3>${seq.titre}</h3>
                    </div>
                </div>
                <div class="sequence-card-progress">
                    <div class="sequence-progress-bar">
                        <div class="sequence-progress-fill" style="width: ${percent}%"></div>
                    </div>
                    <span class="sequence-progress-text">${answeredCount}/${totalQuestions} questions</span>
                </div>
                ${bilanText ? `<div class="sequence-card-bilan">${bilanText}</div>` : ''}
                <div class="sequence-card-action">
                    ${buttonHtml}
                </div>
            </div>
        `;
    }

    getDominantProfile(scores, sequence) {
        const total = Object.values(scores).reduce((a, b) => a + b, 0);
        if (total === 0) return null;

        const sorted = Object.entries(scores)
            .map(([code, score]) => {
                const profileData = sequence.profiles?.[code];
                let name = code;
                
                if (profileData) {
                    if (typeof profileData === 'string') {
                        name = profileData;
                    } else if (typeof profileData === 'object') {
                        name = profileData.name || profileData.titre || code;
                    }
                }
                
                return {
                    code,
                    score,
                    percent: Math.round((score / total) * 100),
                    name: name
                };
            })
            .filter(p => p.score > 0)
            .sort((a, b) => b.score - a.score);

        return sorted[0] || null;
    }

    startSequence(index) {
        console.log('startSequence() appelé avec index:', index);
        this.currentSequenceIndex = index;
        const seq = this.sequences[index];
        console.log('Séquence:', seq?.titre, '- Questions:', seq?.questions?.length);
        
        const progress = this.sequenceProgress[seq.id];
        const answeredCount = Object.keys(progress?.answers || {}).length;
        
        // Si refaire (séquence complétée), reset la progression de cette séquence
        if (progress && progress.completed) {
            this.sequenceProgress[seq.id] = {
                answers: {},
                scores: { A: 0, B: 0, C: 0, D: 0 },
                completed: false,
                currentIndex: 0
            };
            this.currentQuestionIndex = 0;
            // Montrer l'intro car on recommence
            this.showSequenceIntro();
        } 
        // Si séquence déjà commencée (a des réponses mais pas complétée) → reprendre directement
        else if (answeredCount > 0) {
            this.currentQuestionIndex = progress.currentIndex || answeredCount;
            console.log('Reprise directe à la question:', this.currentQuestionIndex);
            this.showQuestion();
        }
        // Sinon, nouvelle séquence → montrer l'intro
        else {
            this.currentQuestionIndex = 0;
            this.showSequenceIntro();
        }
    }

    showSequenceIntro() {
        this.hideAllScreens();
        const seq = this.sequences[this.currentSequenceIndex];

        let introScreen = document.getElementById('quiz-sequence-intro');
        if (!introScreen) {
            introScreen = document.createElement('div');
            introScreen.id = 'quiz-sequence-intro';
            introScreen.className = 'quiz-sequence-intro';
            const container = document.querySelector('.quiz-main');
            if (container) {
                container.appendChild(introScreen);
            } else {
                document.body.appendChild(introScreen);
            }
        }

        introScreen.innerHTML = `
            <div class="sequence-intro-content">
                <span class="sequence-intro-badge">Séquence ${this.currentSequenceIndex + 1}/${this.sequences.length}</span>
                <h2>${seq.titre}</h2>
                ${seq.description ? `<p class="sequence-intro-desc">${seq.description}</p>` : ''}
                ${seq.stat ? `
                    <div class="sequence-intro-stat">
                        <span class="stat-text">${seq.stat}</span>
                        ${seq.stat_source ? `<span class="stat-source">— ${seq.stat_source}</span>` : ''}
                    </div>
                ` : ''}
                <div class="sequence-intro-meta">
                    <span>📝 ${seq.questions.length} questions</span>
                </div>
                <button class="btn-start-sequence" id="btn-start-sequence">
                    C'est parti !
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </button>
            </div>
        `;

        introScreen.style.display = 'block';

        document.getElementById('btn-start-sequence').addEventListener('click', () => {
            this.showQuestion();
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showQuestion() {
        console.log('showQuestion() appelé');
        console.log('currentSequenceIndex:', this.currentSequenceIndex);
        console.log('currentQuestionIndex:', this.currentQuestionIndex);
        
        this.hideAllScreens();
        
        const questionScreen = document.getElementById('quiz-question-screen');
        if (!questionScreen) {
            console.error('quiz-question-screen non trouvé!');
            return;
        }
        questionScreen.style.display = 'block';

        const seq = this.sequences[this.currentSequenceIndex];
        if (!seq) {
            console.error('Séquence non trouvée à l\'index', this.currentSequenceIndex);
            return;
        }
        
        const question = seq.questions[this.currentQuestionIndex];
        if (!question) {
            console.error('Question non trouvée à l\'index', this.currentQuestionIndex, 'dans la séquence', seq.titre);
            return;
        }
        
        console.log('Question:', question.question);

        // Progress bar
        const percent = ((this.currentQuestionIndex + 1) / seq.questions.length) * 100;
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `Question ${this.currentQuestionIndex + 1}/${seq.questions.length}`;

        // Sequence badge dans le contexte
        const contextEl = document.getElementById('quiz-context');
        const contextBadge = document.getElementById('context-badge');
        if (contextEl && contextBadge) {
            contextBadge.innerHTML = `📑 ${seq.titre}`;
            contextEl.style.display = 'block';
        }

        // Question text
        const questionEl = document.getElementById('quiz-question');
        if (questionEl) questionEl.textContent = question.question;

        // Answers
        const answersContainer = document.getElementById('quiz-answers');
        if (answersContainer) {
            answersContainer.innerHTML = question.answers.map(answer => `
                <button class="quiz-answer" data-code="${answer.code}" data-question="${question.id}">
                    <span class="answer-letter">${answer.code}</span>
                    <span class="answer-text">${answer.texte}</span>
                </button>
            `).join('');

            answersContainer.querySelectorAll('.quiz-answer').forEach(btn => {
                btn.addEventListener('click', (e) => this.selectAnswer(e.currentTarget));
            });
        }

        // Hide insight
        const insightEl = document.getElementById('quiz-insight');
        if (insightEl) insightEl.style.display = 'none';

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    selectAnswer(button) {
        const code = button.dataset.code;
        const questionId = button.dataset.question;

        document.querySelectorAll('.quiz-answer').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');

        const seq = this.sequences[this.currentSequenceIndex];
        const progress = this.sequenceProgress[seq.id];

        // Sauvegarder la réponse
        progress.answers[questionId] = code;
        progress.scores[code]++;
        progress.currentIndex = this.currentQuestionIndex;
        
        this.saveProgress();

        // Insight
        const question = seq.questions[this.currentQuestionIndex];
        const insightEl = document.getElementById('quiz-insight');
        const insightText = document.getElementById('insight-text');

        if (question.explication && insightEl && insightText) {
            insightText.textContent = question.explication;
            insightEl.style.display = 'flex';
        } else {
            setTimeout(() => this.nextQuestion(), 600);
        }
    }

    nextQuestion() {
        this.currentQuestionIndex++;
        const seq = this.sequences[this.currentSequenceIndex];

        if (this.currentQuestionIndex >= seq.questions.length) {
            // Fin de la séquence
            this.sequenceProgress[seq.id].completed = true;
            this.sequenceProgress[seq.id].currentIndex = 0;
            this.saveProgress();
            this.showSequenceBilan();
        } else {
            this.sequenceProgress[seq.id].currentIndex = this.currentQuestionIndex;
            this.saveProgress();
            
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

    showSequenceBilan() {
        this.hideAllScreens();
        const seq = this.sequences[this.currentSequenceIndex];
        const progress = this.sequenceProgress[seq.id];
        const scores = progress.scores;

        console.log('=== BILAN SÉQUENCE ===');
        console.log('Séquence:', seq.titre);
        console.log('Scores:', scores);
        console.log('Profils de la séquence:', seq.profiles);

        const total = Object.values(scores).reduce((a, b) => a + b, 0);
        const profileResults = Object.entries(scores)
            .map(([code, score]) => {
                const profileData = seq.profiles?.[code];
                console.log(`Profil ${code}:`, profileData);
                
                let name = code;
                let content = null;
                
                if (profileData) {
                    if (typeof profileData === 'string') {
                        // Ancien format: juste le nom
                        name = profileData;
                    } else if (typeof profileData === 'object') {
                        // Nouveau format: { name: "...", content: "..." }
                        name = profileData.name || profileData.titre || code;
                        content = profileData.content || profileData.description || null;
                    }
                }
                
                return {
                    code,
                    score,
                    percent: total > 0 ? Math.round((score / total) * 100) : 0,
                    name: name,
                    content: content
                };
            })
            .filter(p => p.score > 0)
            .sort((a, b) => b.percent - a.percent);

        console.log('Résultats profils:', profileResults);
        const dominant = profileResults[0];
        console.log('Dominant:', dominant);

        let bilanScreen = document.getElementById('quiz-sequence-bilan');
        if (!bilanScreen) {
            bilanScreen = document.createElement('div');
            bilanScreen.id = 'quiz-sequence-bilan';
            bilanScreen.className = 'quiz-sequence-bilan';
            const container = document.querySelector('.quiz-main');
            if (container) {
                container.appendChild(bilanScreen);
            } else {
                document.body.appendChild(bilanScreen);
            }
        }

        // Formater le contenu du profil dominant
        const profileContent = dominant?.content ? this.formatProfileContent(dominant.content) : '';
        
        // Message si profil dominant mais pas de contenu
        const dominantTitle = dominant ? `<h3 class="dominant-profile-title">Ton profil : ${dominant.name}</h3>` : '';

        bilanScreen.innerHTML = `
            <div class="sequence-bilan-content">
                <div class="sequence-bilan-header">
                    <span class="bilan-badge">✅ Séquence ${this.currentSequenceIndex + 1} terminée</span>
                    <h2>${seq.titre}</h2>
                </div>

                ${dominant ? `
                    <div class="sequence-bilan-dominant">
                        <span class="dominant-emoji">🎯</span>
                        <div class="dominant-info">
                            <span class="dominant-label">Ton profil dominant</span>
                            <span class="dominant-name">${dominant.name}</span>
                            <span class="dominant-percent">${dominant.percent}% de tes réponses</span>
                        </div>
                    </div>
                ` : ''}

                <div class="sequence-bilan-scores">
                    <p class="scores-title">Répartition de tes réponses</p>
                    <div class="scores-bars">
                        ${['A', 'B', 'C', 'D'].map(code => {
                            const result = profileResults.find(p => p.code === code) || { percent: 0, name: code };
                            const isWinner = dominant && code === dominant.code;
                            return `
                                <div class="score-bar ${isWinner ? 'winner' : ''} ${result.percent === 0 ? 'empty' : ''}">
                                    <span class="score-label">${code}</span>
                                    <div class="score-info">
                                        <span class="score-name">${result.name}</span>
                                        <div class="score-track">
                                            <div class="score-fill" style="width: ${result.percent}%"></div>
                                        </div>
                                    </div>
                                    <span class="score-value">${result.percent}%</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                ${profileContent ? `
                    <div class="sequence-bilan-profile-content">
                        ${profileContent}
                    </div>
                ` : ''}

                ${seq.bilan_texte ? `
                    <div class="sequence-bilan-custom-text">
                        <p>${seq.bilan_texte.replace(/\n/g, '<br>')}</p>
                    </div>
                ` : ''}

                ${this.isLastSequence() ? `
                    <button class="btn-continue-sequence" id="btn-go-conclusion">
                        Découvrir la conclusion
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </button>
                ` : `
                    <button class="btn-back-summary" id="btn-back-summary">
                        Retour au sommaire
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </button>
                `}
            </div>
        `;

        bilanScreen.style.display = 'block';

        // Binding du bouton selon le contexte
        if (this.isLastSequence()) {
            document.getElementById('btn-go-conclusion')?.addEventListener('click', () => {
                this.showConclusionScreen();
            });
        } else {
            document.getElementById('btn-back-summary')?.addEventListener('click', () => {
                this.showSummary();
            });
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Formater le contenu du profil en HTML
    formatProfileContent(content) {
        if (!content) return '';
        
        const lines = content.split('\n');
        let html = '';
        let inList = false;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                continue;
            }
            
            // Détecter les lignes commençant par • ou - (listes)
            if (line.match(/^[•\-\*]\s+/)) {
                if (!inList) {
                    html += '<ul class="profile-list">';
                    inList = true;
                }
                html += `<li>${line.replace(/^[•\-\*]\s+/, '')}</li>`;
                continue;
            }
            
            // Fermer la liste si on n'est plus dans une liste
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            
            // Détecter les titres (lignes commençant par emoji ou tout en majuscules)
            const isTitle = line.match(/^[🎯✅⚠️🌱💡🔥💪🎉📌🏆❤️💰📈🛡️⚖️🚀]/);
            const isAllCaps = line === line.toUpperCase() && line.length > 3 && line.match(/[A-Z]/);
            
            if (isTitle || isAllCaps) {
                // C'est un titre
                html += `<h3 class="profile-section-title">${line}</h3>`;
            } else if (line.endsWith(':')) {
                // C'est un sous-titre (se termine par :)
                html += `<h4 class="profile-section-subtitle">${line}</h4>`;
            } else {
                // C'est un paragraphe normal
                html += `<p class="profile-paragraph">${line}</p>`;
            }
        }
        
        if (inList) {
            html += '</ul>';
        }
        
        return html;
    }

    generateBilanText(profileResults) {
        if (!profileResults || profileResults.length === 0) return null;
        
        const dominant = profileResults[0];
        const second = profileResults[1];
        const third = profileResults[2];

        if (!second || second.percent < 15 || dominant.percent > 60) {
            return null;
        }

        if ((dominant.percent - second.percent) < 10) {
            if (third && (dominant.percent - third.percent) < 15) {
                return `Tu combines "${dominant.name}", "${second.name}" et "${third.name}" selon les situations.`;
            }
            return `Tu oscilles entre "${dominant.name}" et "${second.name}".`;
        }

        if (second.percent >= 20) {
            return `Profil "${dominant.name}" avec une touche de "${second.name}".`;
        }

        return null;
    }

    // Vérifie si toutes les séquences sont terminées (on est à la dernière)
    isLastSequence() {
        return this.sequences.every(seq => this.sequenceProgress[seq.id]?.completed);
    }

    // Affiche l'écran de conclusion intermédiaire
    showConclusionScreen() {
        this.hideAllScreens();

        console.log('=== ÉCRAN CONCLUSION ===');

        const quiz = this.quiz;
        
        // Vérifier s'il y a du contenu de conclusion
        const hasTitle = quiz.conclusion_title;
        const hasNotList = quiz.conclusion_not && Array.isArray(quiz.conclusion_not) && quiz.conclusion_not.length > 0;
        const hasIsList = quiz.conclusion_is && Array.isArray(quiz.conclusion_is) && quiz.conclusion_is.length > 0;
        const hasQuote = quiz.conclusion_quote;
        const hasCta = quiz.conclusion_cta;

        // Si aucun contenu de conclusion, aller directement au bilan final
        if (!hasTitle && !hasNotList && !hasIsList && !hasQuote && !hasCta) {
            console.log('Pas de contenu de conclusion, passage direct au bilan final');
            this.showFinalResult();
            return;
        }

        // Créer ou récupérer l'écran de conclusion
        let conclusionScreen = document.getElementById('quiz-conclusion-screen');
        if (!conclusionScreen) {
            conclusionScreen = document.createElement('div');
            conclusionScreen.id = 'quiz-conclusion-screen';
            conclusionScreen.className = 'quiz-conclusion-screen';
            const container = document.querySelector('.quiz-main');
            if (container) {
                container.appendChild(conclusionScreen);
            } else {
                document.body.appendChild(conclusionScreen);
            }
        }

        // Générer le HTML de la conclusion
        conclusionScreen.innerHTML = `
            <div class="conclusion-screen-content">
                <!-- Header -->
                <div class="conclusion-screen-header">
                    <span class="conclusion-badge">🏆 Quiz terminé !</span>
                    ${hasTitle ? `<h1 class="conclusion-main-title">${quiz.conclusion_title}</h1>` : '<h1 class="conclusion-main-title">Ce qu\'il faut retenir</h1>'}
                </div>

                <!-- Colonnes Ce que c'est / Ce que ce n'est pas -->
                ${(hasNotList || hasIsList) ? `
                    <div class="conclusion-screen-columns">
                        ${hasNotList ? `
                            <div class="conclusion-screen-column not-column">
                                <div class="column-header">
                                    <span class="column-icon">❌</span>
                                    <span class="column-label">Ce que ce n'est PAS</span>
                                </div>
                                <ul class="column-list">
                                    ${quiz.conclusion_not.map(item => `<li>${item}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${hasIsList ? `
                            <div class="conclusion-screen-column is-column">
                                <div class="column-header">
                                    <span class="column-icon">✅</span>
                                    <span class="column-label">Ce que c'EST</span>
                                </div>
                                <ul class="column-list">
                                    ${quiz.conclusion_is.map(item => `<li>${item}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- Citation -->
                ${hasQuote ? `
                    <div class="conclusion-screen-quote">
                        <blockquote>"${quiz.conclusion_quote}"</blockquote>
                    </div>
                ` : ''}

                <!-- Message CTA -->
                ${hasCta ? `
                    <p class="conclusion-screen-cta-text">${quiz.conclusion_cta}</p>
                ` : ''}

                <!-- Bouton vers le bilan final -->
                <button class="btn-see-final-result" id="btn-see-final-result">
                    🎯 Voir mon bilan complet
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </button>
                
                <a href="quizzes.html" class="btn-back-quizzes-conclusion">← Retour aux quiz</a>
            </div>
        `;

        conclusionScreen.style.display = 'block';

        // Binding du bouton
        document.getElementById('btn-see-final-result')?.addEventListener('click', () => {
            this.showFinalResult();
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showFinalResult() {
        this.hideAllScreens();

        console.log('=== BILAN FINAL ===');

        // Calculer les scores globaux
        const globalScores = { A: 0, B: 0, C: 0, D: 0 };
        this.sequences.forEach(seq => {
            const progress = this.sequenceProgress[seq.id];
            if (progress && progress.scores) {
                Object.entries(progress.scores).forEach(([code, score]) => {
                    globalScores[code] += score;
                });
            }
        });

        console.log('Scores globaux:', globalScores);

        const total = Object.values(globalScores).reduce((a, b) => a + b, 0);
        
        // Trier les profils par score décroissant
        const sortedProfiles = Object.entries(globalScores)
            .map(([code, score]) => ({
                code,
                score,
                percent: total > 0 ? Math.round((score / total) * 100) : 0
            }))
            .sort((a, b) => b.percent - a.percent);

        const dominant = sortedProfiles[0];
        const secondary = sortedProfiles[1];
        const ecart = dominant.percent - secondary.percent;

        console.log('Dominant:', dominant, 'Secondary:', secondary, 'Écart:', ecart);

        // Déterminer le type de profil
        let profileType = 'pure'; // > 20% d'écart
        if (ecart <= 10 && secondary.percent > 0) {
            profileType = 'hybrid'; // ≤ 10% d'écart
        } else if (ecart <= 20 && secondary.percent > 0) {
            profileType = 'tendency'; // 10-20% d'écart
        }

        console.log('Type de profil:', profileType);

        // Récupérer les données des profils
        const dominantProfile = this.profiles.find(p => p.code === dominant.code) || this.getDefaultProfile(dominant.code);
        const secondaryProfile = this.profiles.find(p => p.code === secondary.code) || this.getDefaultProfile(secondary.code);

        // Calculer les pourcentages pour l'affichage
        const globalResults = Object.entries(globalScores)
            .map(([code, score]) => {
                const profile = this.profiles.find(p => p.code === code);
                return {
                    code,
                    score,
                    percent: total > 0 ? Math.round((score / total) * 100) : 0,
                    name: profile?.nom || profile?.titre || `Profil ${code}`,
                    emoji: profile?.emoji || '🎯'
                };
            })
            .filter(p => p.score > 0)
            .sort((a, b) => b.percent - a.percent);

        // Préparer le récapitulatif par séquence
        const sequenceResults = this.sequences.map((seq, index) => {
            const progress = this.sequenceProgress[seq.id];
            if (!progress || !progress.scores) return null;
            
            const seqTotal = Object.values(progress.scores).reduce((a, b) => a + b, 0);
            if (seqTotal === 0) return null;
            
            const seqDominant = Object.entries(progress.scores)
                .sort((a, b) => b[1] - a[1])[0];
            
            const profileData = seq.profiles?.[seqDominant[0]];
            let profileName = seqDominant[0];
            if (profileData) {
                if (typeof profileData === 'string') {
                    profileName = profileData;
                } else if (profileData.name) {
                    profileName = profileData.name;
                }
            }
            
            return {
                numero: index + 1,
                titre: seq.titre,
                dominantCode: seqDominant[0],
                dominantName: profileName,
                percent: Math.round((seqDominant[1] / seqTotal) * 100)
            };
        }).filter(Boolean);

        this.markCompleted(dominant.code);

        // Générer le HTML du profil selon le type
        let profileHTML = '';
        
        if (profileType === 'pure') {
            // Profil pur (> 20% d'écart)
            profileHTML = `
                <div class="result-main-profile profile-pure">
                    <div class="result-profile-badge">Ton profil dominant</div>
                    <div class="result-profile-icon">${dominantProfile.emoji || '🎯'}</div>
                    <h2 class="result-profile-name">${dominantProfile.titre || dominantProfile.nom || `Profil ${dominant.code}`}</h2>
                    ${dominantProfile.sous_titre ? `<p class="result-profile-subtitle">${dominantProfile.sous_titre}</p>` : ''}
                    <div class="result-profile-percent">
                        <span class="percent-value">${dominant.percent}%</span>
                        <span class="percent-label">de tes réponses</span>
                    </div>
                </div>
            `;
        } else if (profileType === 'tendency') {
            // Profil + Tendance (10-20% d'écart)
            profileHTML = `
                <div class="result-main-profile profile-tendency">
                    <div class="result-profile-badge">Ton profil dominant</div>
                    <div class="result-profile-icon">${dominantProfile.emoji || '🎯'}</div>
                    <h2 class="result-profile-name">${dominantProfile.titre || dominantProfile.nom || `Profil ${dominant.code}`}</h2>
                    ${dominantProfile.sous_titre ? `<p class="result-profile-subtitle">${dominantProfile.sous_titre}</p>` : ''}
                    <div class="result-profile-percent">
                        <span class="percent-value">${dominant.percent}%</span>
                        <span class="percent-label">de tes réponses</span>
                    </div>
                    
                    <div class="result-tendency">
                        <div class="tendency-separator"></div>
                        <div class="tendency-content">
                            <span class="tendency-icon">${secondaryProfile.emoji || '🎯'}</span>
                            <div class="tendency-text">
                                <span class="tendency-label">Avec une tendance</span>
                                <span class="tendency-name">${secondaryProfile.nom || `Profil ${secondary.code}`}</span>
                                <span class="tendency-percent">${secondary.percent}% de tes réponses</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Profil hybride (≤ 10% d'écart)
            const combinedPercent = dominant.percent + secondary.percent;
            profileHTML = `
                <div class="result-main-profile profile-hybrid">
                    <div class="result-profile-badge">Ton profil hybride</div>
                    <div class="result-profile-icons">
                        <span class="hybrid-icon">${dominantProfile.emoji || '🎯'}</span>
                        <span class="hybrid-separator">+</span>
                        <span class="hybrid-icon">${secondaryProfile.emoji || '🎯'}</span>
                    </div>
                    <h2 class="result-profile-name hybrid-name">
                        ${dominantProfile.nom || `Profil ${dominant.code}`}-${secondaryProfile.nom || `Profil ${secondary.code}`}
                    </h2>
                    <p class="result-profile-subtitle">
                        ${dominantProfile.sous_titre || ''} & ${secondaryProfile.sous_titre || ''}
                    </p>
                    <div class="result-profile-percent hybrid-percent">
                        <span class="percent-value">${combinedPercent}%</span>
                        <span class="percent-label">de tes réponses combinées</span>
                    </div>
                    <div class="hybrid-breakdown">
                        <span class="hybrid-detail">${dominantProfile.nom}: ${dominant.percent}%</span>
                        <span class="hybrid-detail">${secondaryProfile.nom}: ${secondary.percent}%</span>
                    </div>
                </div>
            `;
        }

        // Générer la description selon le type
        let descriptionHTML = '';
        if (profileType === 'hybrid') {
            // Description combinée pour profil hybride
            descriptionHTML = `
                <div class="result-description hybrid-description">
                    <p>${this.generateHybridDescription(dominantProfile, secondaryProfile)}</p>
                </div>
            `;
        } else if (profileType === 'tendency') {
            // Description principale + note sur la tendance
            descriptionHTML = `
                <div class="result-description">
                    <p>${dominantProfile.description || ''}</p>
                    ${secondaryProfile.description ? `
                        <div class="tendency-note">
                            <strong>Ta tendance ${secondaryProfile.nom} signifie aussi :</strong> 
                            ${this.extractTendencyNote(secondaryProfile.description)}
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            // Description simple
            descriptionHTML = dominantProfile.description ? `
                <div class="result-description">
                    <p>${dominantProfile.description}</p>
                </div>
            ` : '';
        }

        // Générer les forces/vigilances selon le type
        let traitsHTML = '';
        if (profileType === 'hybrid') {
            // Combiner les forces et vigilances des deux profils
            const combinedForces = [
                ...(dominantProfile.forces || []).slice(0, 3),
                ...(secondaryProfile.forces || []).slice(0, 2)
            ];
            const combinedVigilances = [
                ...(dominantProfile.vigilances || []).slice(0, 2),
                ...(secondaryProfile.vigilances || []).slice(0, 2)
            ];
            
            if (combinedForces.length > 0 || combinedVigilances.length > 0) {
                traitsHTML = `
                    <div class="result-traits">
                        ${combinedForces.length > 0 ? `
                            <div class="trait-card forces">
                                <div class="trait-header">
                                    <span class="trait-icon">💪</span>
                                    <h3>Tes forces combinées</h3>
                                </div>
                                <ul class="trait-list">
                                    ${combinedForces.map(f => `<li>${f}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${combinedVigilances.length > 0 ? `
                            <div class="trait-card vigilances">
                                <div class="trait-header">
                                    <span class="trait-icon">⚠️</span>
                                    <h3>Points de vigilance</h3>
                                </div>
                                <ul class="trait-list">
                                    ${combinedVigilances.map(v => `<li>${v}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
        } else {
            // Forces et vigilances du profil dominant
            if ((dominantProfile.forces?.length > 0 || dominantProfile.vigilances?.length > 0)) {
                traitsHTML = `
                    <div class="result-traits">
                        ${dominantProfile.forces?.length > 0 ? `
                            <div class="trait-card forces">
                                <div class="trait-header">
                                    <span class="trait-icon">💪</span>
                                    <h3>Tes forces</h3>
                                </div>
                                <ul class="trait-list">
                                    ${dominantProfile.forces.map(f => `<li>${f}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${dominantProfile.vigilances?.length > 0 ? `
                            <div class="trait-card vigilances">
                                <div class="trait-header">
                                    <span class="trait-icon">⚠️</span>
                                    <h3>Points de vigilance</h3>
                                </div>
                                <ul class="trait-list">
                                    ${dominantProfile.vigilances.map(v => `<li>${v}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
        }

        // Créer ou récupérer l'écran de résultat
        let resultScreen = document.getElementById('quiz-result-screen');
        if (!resultScreen) {
            resultScreen = document.createElement('div');
            resultScreen.id = 'quiz-result-screen';
            resultScreen.className = 'quiz-result-screen';
            const container = document.querySelector('.quiz-main');
            if (container) {
                container.appendChild(resultScreen);
            } else {
                document.body.appendChild(resultScreen);
            }
        }

        // Générer le HTML complet
        resultScreen.innerHTML = `
            <div class="result-content">
                <!-- Header célébration -->
                <div class="result-celebration">
                    <span class="celebration-emoji">🎉</span>
                    <h1>Quiz terminé !</h1>
                    <p class="result-quiz-title">${this.quiz.titre}</p>
                </div>

                <!-- Profil (pur, tendance ou hybride) -->
                ${profileHTML}

                <!-- Description -->
                ${descriptionHTML}

                <!-- Forces et vigilances -->
                ${traitsHTML}

                <!-- Répartition globale -->
                <div class="result-distribution">
                    <h3>📊 Répartition de tes réponses</h3>
                    <div class="distribution-bars">
                        ${['A', 'B', 'C', 'D'].map(code => {
                            const result = globalResults.find(p => p.code === code) || { percent: 0, name: `Profil ${code}` };
                            const isWinner = code === dominant.code;
                            const isSecondary = code === secondary.code && profileType !== 'pure';
                            return `
                                <div class="distribution-bar ${isWinner ? 'winner' : ''} ${isSecondary ? 'secondary' : ''} ${result.percent === 0 ? 'empty' : ''}">
                                    <div class="dist-header">
                                        <span class="dist-letter ${isWinner ? 'winner' : ''} ${isSecondary ? 'secondary' : ''}">${code}</span>
                                        <span class="dist-name">${result.name}</span>
                                        <span class="dist-percent">${result.percent}%</span>
                                    </div>
                                    <div class="dist-track">
                                        <div class="dist-fill ${isSecondary ? 'secondary' : ''}" style="width: ${result.percent}%"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Récapitulatif par séquence -->
                ${sequenceResults.length > 0 ? `
                    <div class="result-sequences-recap">
                        <h3>📑 Tes résultats par séquence</h3>
                        <div class="sequences-recap-grid">
                            ${sequenceResults.map(seq => `
                                <div class="sequence-recap-card">
                                    <div class="recap-seq-header">
                                        <span class="recap-seq-num">Séq. ${seq.numero}</span>
                                        <span class="recap-seq-title">${seq.titre}</span>
                                    </div>
                                    <div class="recap-seq-result">
                                        <span class="recap-profile-name">${seq.dominantName}</span>
                                        <span class="recap-profile-percent">${seq.percent}%</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- CTA final -->
                <div class="result-cta">
                    <p class="cta-text">Bravo pour ce premier pas ! Continue ton parcours :</p>
                    <div class="result-buttons">
                        <a href="webinaires.html" class="btn-result-primary">
                            🎥 Découvrir les webinaires
                        </a>
                        <button class="btn-result-secondary" id="btn-restart-quiz">
                            🔄 Refaire le quiz
                        </button>
                    </div>
                    <a href="quizzes.html" class="btn-back-quizzes">← Retour aux quiz</a>
                </div>
            </div>
        `;

        resultScreen.style.display = 'block';

        // Bind du bouton refaire
        document.getElementById('btn-restart-quiz')?.addEventListener('click', () => {
            this.clearProgress();
            this.initializeSequenceProgress();
            this.showIntro();
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Génère une description hybride combinant deux profils
    generateHybridDescription(profile1, profile2) {
        const name1 = profile1.nom || 'Premier profil';
        const name2 = profile2.nom || 'Second profil';
        
        // Extraire la première phrase de chaque description
        const desc1 = profile1.description ? profile1.description.split('.')[0] + '.' : '';
        const desc2 = profile2.description ? profile2.description.split('.')[0] + '.' : '';
        
        if (!desc1 && !desc2) {
            return `Tu combines les qualités du profil ${name1} et du profil ${name2}, ce qui te donne une approche équilibrée et nuancée de l'éducation financière.`;
        }
        
        // Connecteurs pour lier les deux descriptions
        const connectors = [
            'En même temps,',
            'Parallèlement,',
            'Tu sais aussi que',
            'Cette approche se combine avec le fait que'
        ];
        const connector = connectors[Math.floor(Math.random() * connectors.length)];
        
        return `${desc1} ${connector.toLowerCase()} ${desc2.charAt(0).toLowerCase() + desc2.slice(1)}`;
    }

    // Extrait une note courte d'une description pour la tendance
    extractTendencyNote(description) {
        if (!description) return '';
        
        // Prendre la deuxième phrase ou tronquer la première
        const sentences = description.split('.');
        if (sentences.length > 1 && sentences[1].trim()) {
            return sentences[1].trim() + '.';
        }
        // Si une seule phrase, la tronquer
        if (description.length > 100) {
            return description.substring(0, 100) + '...';
        }
        return description;
    }

    // Génère la section conclusion (titre + ce que c'est / ce que ce n'est pas)
    renderConclusionSection() {
        const quiz = this.quiz;
        
        // Vérifier s'il y a du contenu de conclusion à afficher
        const hasTitle = quiz.conclusion_title;
        const hasNotList = quiz.conclusion_not && Array.isArray(quiz.conclusion_not) && quiz.conclusion_not.length > 0;
        const hasIsList = quiz.conclusion_is && Array.isArray(quiz.conclusion_is) && quiz.conclusion_is.length > 0;
        
        // Si aucun contenu de conclusion, retourner vide
        if (!hasTitle && !hasNotList && !hasIsList) {
            return '';
        }

        let html = '<div class="result-conclusion-section">';
        
        // Titre de conclusion
        if (hasTitle) {
            html += `<h3 class="conclusion-section-title">${quiz.conclusion_title}</h3>`;
        }
        
        // Grille des deux colonnes si les deux listes existent
        if (hasNotList || hasIsList) {
            html += '<div class="conclusion-columns">';
            
            // Colonne "Ce que ce n'est PAS"
            if (hasNotList) {
                html += `
                    <div class="conclusion-column conclusion-not">
                        <div class="conclusion-column-header">
                            <span class="conclusion-column-icon">❌</span>
                            <span class="conclusion-column-label">Ce que ce n'est PAS</span>
                        </div>
                        <ul class="conclusion-list">
                            ${quiz.conclusion_not.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
            
            // Colonne "Ce que c'EST"
            if (hasIsList) {
                html += `
                    <div class="conclusion-column conclusion-is">
                        <div class="conclusion-column-header">
                            <span class="conclusion-column-icon">✅</span>
                            <span class="conclusion-column-label">Ce que c'EST</span>
                        </div>
                        <ul class="conclusion-list">
                            ${quiz.conclusion_is.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
            
            html += '</div>'; // fin conclusion-columns
        }
        
        html += '</div>'; // fin result-conclusion-section
        
        return html;
    }

    getDefaultProfile(code) {
        const defaults = {
            A: { emoji: '🛡️', titre: 'Profil A', description: '' },
            B: { emoji: '⚖️', titre: 'Profil B', description: '' },
            C: { emoji: '🎯', titre: 'Profil C', description: '' },
            D: { emoji: '🚀', titre: 'Profil D', description: '' }
        };
        return defaults[code] || { emoji: '❓', titre: `Profil ${code}`, description: '' };
    }

    showError(message) {
        const loadingEl = document.getElementById('quiz-loading');
        if (loadingEl) loadingEl.style.display = 'none';
        
        const container = document.querySelector('.quiz-main');
        if (container) {
            container.innerHTML = `
                <div class="quiz-error">
                    <span class="error-icon">😕</span>
                    <h2>Oups !</h2>
                    <p>${message}</p>
                    <a href="quizzes.html" class="btn-back">Voir tous les quiz</a>
                </div>
            `;
        } else {
            alert('Erreur: ' + message);
        }
    }

    hideAllScreens() {
        const screens = [
            'quiz-loading', 'quiz-intro', 'quiz-question-screen', 
            'quiz-result-screen', 'quiz-summary', 'quiz-sequence-intro', 
            'quiz-sequence-bilan', 'quiz-conclusion-screen'
        ];
        screens.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    // ============================================
    // EVENTS
    // ============================================

    bindEvents() {
        console.log('bindEvents() appelé');
        
        // Bouton démarrer
        const startBtn = document.getElementById('btn-start');
        console.log('btn-start trouvé:', startBtn);
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                console.log('Clic sur btn-start');
                this.clearProgress();
                this.initializeSequenceProgress();
                this.showSummary();
            });
        }

        // Bouton reprendre
        const resumeBtn = document.getElementById('btn-resume');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                console.log('Clic sur btn-resume');
                this.showSummary();
            });
        }

        // Bouton recommencer
        const restartFreshBtn = document.getElementById('btn-restart-fresh');
        if (restartFreshBtn) {
            restartFreshBtn.addEventListener('click', () => {
                console.log('Clic sur btn-restart-fresh');
                this.clearProgress();
                this.initializeSequenceProgress();
                this.showSummary();
            });
        }

        // Bouton suivant (après insight)
        const nextBtn = document.getElementById('btn-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.nextQuestion();
            });
        }

        // Bouton recommencer (résultat final)
        const restartBtn = document.getElementById('btn-restart');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.clearProgress();
                this.initializeSequenceProgress();
                this.showIntro();
            });
        }
    }
}

// ============================================
// INITIALISATION
// ============================================

let quizEngine = null; // Variable globale pour debug

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('quiz') || urlParams.get('slug');
    const isPreview = urlParams.get('preview') === 'true';

    if (slug) {
        initSupabase();
        quizEngine = new QuizEngine();
        quizEngine.init(slug, isPreview);
        window.quizEngine = quizEngine; // Exposer pour debug
    } else {
        document.getElementById('quiz-loading').innerHTML = `
            <p>Aucun quiz spécifié</p>
            <a href="quizzes.html">Voir tous les quiz</a>
        `;
    }
});

// Fonctions globales pour les boutons (fallback)
function startQuiz() {
    console.log('startQuiz() appelé');
    if (quizEngine) {
        quizEngine.clearProgress();
        quizEngine.initializeSequenceProgress();
        quizEngine.showSummary();
    }
}

function resumeQuiz() {
    console.log('resumeQuiz() appelé');
    if (quizEngine) {
        quizEngine.showSummary();
    }
}