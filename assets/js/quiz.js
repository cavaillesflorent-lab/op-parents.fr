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
        allProgress[this.quizSlug] = {
            sequenceProgress: this.sequenceProgress,
            completed: this.isQuizCompleted(),
            updatedAt: new Date().toISOString()
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
            .map(([code, score]) => ({
                code,
                score,
                percent: Math.round((score / total) * 100),
                name: sequence.profiles?.[code] || code
            }))
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
        
        // Si refaire, reset la progression de cette séquence
        if (progress && progress.completed) {
            this.sequenceProgress[seq.id] = {
                answers: {},
                scores: { A: 0, B: 0, C: 0, D: 0 },
                completed: false,
                currentIndex: 0
            };
        }
        
        this.currentQuestionIndex = this.sequenceProgress[seq.id]?.currentIndex || 0;
        console.log('currentQuestionIndex:', this.currentQuestionIndex);
        this.showSequenceIntro();
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

        const total = Object.values(scores).reduce((a, b) => a + b, 0);
        const profileResults = Object.entries(scores)
            .map(([code, score]) => ({
                code,
                score,
                percent: total > 0 ? Math.round((score / total) * 100) : 0,
                name: seq.profiles?.[code] || code
            }))
            .filter(p => p.score > 0)
            .sort((a, b) => b.percent - a.percent);

        const dominant = profileResults[0];

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

        const bilanText = this.generateBilanText(profileResults);

        bilanScreen.innerHTML = `
            <div class="sequence-bilan-content">
                <div class="sequence-bilan-header">
                    <span class="bilan-badge">✅ Séquence ${this.currentSequenceIndex + 1} terminée</span>
                    <h2>${seq.titre}</h2>
                </div>

                <div class="sequence-bilan-result">
                    <div class="bilan-dominant">
                        <span class="bilan-dominant-label">Tu es</span>
                        <span class="bilan-dominant-name">${dominant?.name || 'Indéterminé'}</span>
                        <span class="bilan-dominant-percent">${dominant?.percent || 0}%</span>
                    </div>
                    ${bilanText ? `<p class="bilan-text">${bilanText}</p>` : ''}
                </div>

                <div class="sequence-bilan-scores">
                    <p class="scores-title">Répartition de tes réponses</p>
                    <div class="scores-bars">
                        ${['A', 'B', 'C', 'D'].map(code => {
                            const result = profileResults.find(p => p.code === code) || { percent: 0, name: seq.profiles?.[code] || code };
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

                <button class="btn-back-summary" id="btn-back-summary">
                    Retour au sommaire
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </button>
            </div>
        `;

        bilanScreen.style.display = 'block';

        document.getElementById('btn-back-summary').addEventListener('click', () => {
            this.showSummary();
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
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

    showFinalResult() {
        this.hideAllScreens();

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

        const total = Object.values(globalScores).reduce((a, b) => a + b, 0);
        const dominant = Object.entries(globalScores)
            .sort((a, b) => b[1] - a[1])[0][0];

        const profile = this.profiles.find(p => p.code === dominant) || this.getDefaultProfile(dominant);

        this.markCompleted(dominant);

        document.getElementById('quiz-result-screen').style.display = 'block';

        // Afficher le profil (avec les bons IDs du HTML)
        const resultIcon = document.getElementById('result-icon');
        const resultName = document.getElementById('result-profile-name');
        const resultSubtitle = document.getElementById('result-profile-subtitle');
        const resultDesc = document.getElementById('result-description-text');
        
        if (resultIcon) resultIcon.textContent = profile.emoji || '🎯';
        if (resultName) resultName.textContent = profile.titre || profile.nom || `Profil ${dominant}`;
        if (resultSubtitle) resultSubtitle.textContent = profile.sous_titre || '';
        if (resultDesc) resultDesc.textContent = profile.description || '';

        // Forces et vigilances
        const forcesList = document.getElementById('result-forces-list');
        const vigilancesList = document.getElementById('result-vigilances-list');
        
        if (forcesList && profile.forces && profile.forces.length > 0) {
            forcesList.innerHTML = profile.forces.map(f => `<li>${f}</li>`).join('');
        }
        if (vigilancesList && profile.vigilances && profile.vigilances.length > 0) {
            vigilancesList.innerHTML = profile.vigilances.map(v => `<li>${v}</li>`).join('');
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
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
            'quiz-sequence-bilan'
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