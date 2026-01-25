// ============================================
// CHARGEUR DE COMPOSANTS - OP! Parents
// ============================================

class ComponentLoader {
    constructor() {
        this.basePath = this.getBasePath();
    }

    // Détecte si on est dans un sous-dossier (admin/)
    getBasePath() {
        const path = window.location.pathname;
        if (path.includes('/admin/')) {
            return '../';
        }
        return '';
    }

    // Charge un composant HTML dans un élément
    async loadComponent(componentName, targetSelector) {
        const target = document.querySelector(targetSelector);
        if (!target) {
            console.warn(`Element ${targetSelector} non trouvé`);
            return;
        }

        try {
            const response = await fetch(`${this.basePath}components/${componentName}.html`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            let html = await response.text();
            
            // Ajuste les chemins si on est dans un sous-dossier
            if (this.basePath) {
                html = this.adjustPaths(html);
            }
            
            target.innerHTML = html;
            
            // Marque la page active dans la navigation
            this.setActivePage();
            
            // Initialise le menu mobile
            this.initMobileMenu();
            
        } catch (error) {
            console.error(`Erreur chargement ${componentName}:`, error);
        }
    }

    // Ajuste les chemins relatifs pour les sous-dossiers
    adjustPaths(html) {
        // Remplace les chemins relatifs
        html = html.replace(/href="(?!http|#|mailto)([^"]+)"/g, `href="${this.basePath}$1"`);
        html = html.replace(/src="(?!http)([^"]+)"/g, `src="${this.basePath}$1"`);
        return html;
    }

    // Marque la page active dans la navigation
    setActivePage() {
        const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
        const navLinks = document.querySelectorAll('.nav a[data-page]');
        
        navLinks.forEach(link => {
            if (link.dataset.page === currentPage) {
                link.classList.add('active');
            }
        });
    }

    // Initialise le menu mobile
    initMobileMenu() {
        const toggle = document.querySelector('.mobile-toggle');
        const nav = document.querySelector('.nav');
        
        if (!toggle || !nav) {
            console.warn('Menu mobile: éléments non trouvés');
            return;
        }

        // Injecte les styles critiques pour le menu mobile (fallback)
        this.injectMobileStyles();
        
        // Gestion du clic sur le hamburger
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isOpen = nav.classList.contains('nav-open');
            
            if (isOpen) {
                nav.classList.remove('nav-open', 'active');
                toggle.classList.remove('active');
                document.body.style.overflow = '';
            } else {
                nav.classList.add('nav-open', 'active');
                toggle.classList.add('active');
                document.body.style.overflow = 'hidden'; // Empêche le scroll
            }
        });

        // Ferme le menu si on clique sur un lien
        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('nav-open', 'active');
                toggle.classList.remove('active');
                document.body.style.overflow = '';
            });
        });

        // Ferme le menu si on clique en dehors
        document.addEventListener('click', (e) => {
            if (nav.classList.contains('nav-open') && 
                !nav.contains(e.target) && 
                !toggle.contains(e.target)) {
                nav.classList.remove('nav-open', 'active');
                toggle.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // Injecte les styles critiques pour le menu mobile
    injectMobileStyles() {
        // Vérifie si les styles sont déjà injectés
        if (document.getElementById('mobile-menu-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'mobile-menu-styles';
        styles.textContent = `
            /* Menu mobile - styles critiques */
            @media (max-width: 768px) {
                .header .mobile-toggle {
                    display: flex !important;
                    flex-direction: column;
                    gap: 5px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 5px;
                    z-index: 1001;
                }

                .header .mobile-toggle span {
                    width: 24px;
                    height: 2px;
                    background: #fff;
                    border-radius: 2px;
                    transition: all 0.3s ease;
                }

                /* Animation hamburger vers X */
                .header .mobile-toggle.active span:nth-child(1) {
                    transform: rotate(45deg) translate(5px, 5px);
                }

                .header .mobile-toggle.active span:nth-child(2) {
                    opacity: 0;
                }

                .header .mobile-toggle.active span:nth-child(3) {
                    transform: rotate(-45deg) translate(5px, -5px);
                }

                .header .nav {
                    display: none !important;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: #F0D075;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: 2rem;
                    gap: 1.5rem;
                    z-index: 1000;
                }

                .header .nav.nav-open,
                .header .nav.active {
                    display: flex !important;
                }

                .header .nav a {
                    font-size: 1.3rem;
                    padding: 0.75rem 1rem;
                    color: #fff;
                }

                .header .nav a::after {
                    display: none;
                }
            }

            @media (min-width: 769px) {
                .header .mobile-toggle {
                    display: none !important;
                }

                .header .nav {
                    display: flex !important;
                    position: static;
                    background: transparent;
                    flex-direction: row;
                    padding: 0;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    // Charge header et footer
    async loadAll() {
        await Promise.all([
            this.loadComponent('header', '#header-placeholder'),
            this.loadComponent('footer', '#footer-placeholder')
        ]);
    }
}

// Auto-initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', async () => {
    const loader = new ComponentLoader();
    await loader.loadAll();
    
    // Dispatch un événement quand les composants sont chargés
    document.dispatchEvent(new CustomEvent('componentsLoaded'));
});

// Export
window.ComponentLoader = ComponentLoader;