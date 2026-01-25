// ============================================
// CHARGEUR DE COMPOSANTS - OP! Parents
// Version bulletproof avec menu mobile
// ============================================

class ComponentLoader {
    constructor() {
        this.basePath = this.getBasePath();
        this.mobileMenuInitialized = false; // Flag pour éviter double init
    }

    getBasePath() {
        const path = window.location.pathname;
        if (path.includes('/admin/')) {
            return '../';
        }
        return '';
    }

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
            
            if (this.basePath) {
                html = this.adjustPaths(html);
            }
            
            target.innerHTML = html;
            
            this.setActivePage();
            
            // Initialise le menu mobile SEULEMENT pour le header
            if (componentName === 'header' && !this.mobileMenuInitialized) {
                setTimeout(() => {
                    this.initMobileMenu();
                }, 100);
            }
            
        } catch (error) {
            console.error(`Erreur chargement ${componentName}:`, error);
        }
    }

    adjustPaths(html) {
        html = html.replace(/href="(?!http|#|mailto)([^"]+)"/g, `href="${this.basePath}$1"`);
        html = html.replace(/src="(?!http)([^"]+)"/g, `src="${this.basePath}$1"`);
        return html;
    }

    setActivePage() {
        const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
        const navLinks = document.querySelectorAll('.nav a[data-page]');
        
        navLinks.forEach(link => {
            if (link.dataset.page === currentPage) {
                link.classList.add('active');
            }
        });
    }

    initMobileMenu() {
        // Évite la double initialisation
        if (this.mobileMenuInitialized) {
            console.log('Menu mobile: déjà initialisé, skip');
            return;
        }

        const toggle = document.querySelector('.mobile-toggle');
        const nav = document.querySelector('.nav');
        
        if (!toggle || !nav) {
            console.error('Menu mobile: éléments non trouvés', { toggle, nav });
            return;
        }

        this.mobileMenuInitialized = true;
        console.log('Menu mobile: initialisation...');

        // Détecte si on est sur mobile
        const isMobile = () => window.innerWidth <= 768;

        // État du menu
        let isMenuOpen = false;

        // Applique les styles du toggle pour mobile
        const applyMobileStyles = () => {
            if (isMobile()) {
                // Style du bouton hamburger
                toggle.style.cssText = `
                    display: flex !important;
                    flex-direction: column;
                    gap: 5px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 10px;
                    z-index: 1001;
                    position: relative;
                `;
                
                // Style des barres du hamburger
                toggle.querySelectorAll('span').forEach(span => {
                    span.style.cssText = `
                        display: block;
                        width: 24px;
                        height: 2px;
                        background: #fff;
                        border-radius: 2px;
                        transition: all 0.3s ease;
                    `;
                });

                // Cache la nav par défaut sur mobile (seulement si pas ouverte)
                if (!isMenuOpen) {
                    nav.style.cssText = `display: none !important;`;
                }
            } else {
                // Desktop : reset les styles
                toggle.style.cssText = `display: none !important;`;
                nav.style.cssText = `
                    display: flex !important;
                    position: static;
                    background: transparent;
                    flex-direction: row;
                    align-items: center;
                    gap: 2rem;
                `;
                // Reset les styles des liens pour desktop
                nav.querySelectorAll('a').forEach(link => {
                    link.style.cssText = '';
                });
                isMenuOpen = false;
            }
        };

        // Ouvre le menu
        const openMenu = () => {
            if (isMenuOpen) return;
            
            isMenuOpen = true;
            nav.classList.add('nav-open');
            toggle.classList.add('active');
            
            nav.style.cssText = `
                display: flex !important;
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
            `;
            
            document.body.style.overflow = 'hidden';
            
            // Style des liens dans le menu ouvert
            nav.querySelectorAll('a').forEach(link => {
                link.style.cssText = `
                    font-size: 1.3rem;
                    padding: 0.75rem 1rem;
                    color: #fff;
                    text-decoration: none;
                `;
            });
            
            // Animation hamburger vers X
            const spans = toggle.querySelectorAll('span');
            spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
            
            console.log('Menu ouvert');
        };

        // Ferme le menu
        const closeMenu = () => {
            if (!isMenuOpen) return;
            
            isMenuOpen = false;
            nav.classList.remove('nav-open');
            toggle.classList.remove('active');
            
            nav.style.cssText = `display: none !important;`;
            document.body.style.overflow = '';
            
            // Reset animation hamburger
            const spans = toggle.querySelectorAll('span');
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
            
            console.log('Menu fermé');
        };

        // Toggle le menu
        const toggleMenu = () => {
            if (isMenuOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        };

        // Event listener sur le bouton hamburger
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Toggle cliqué! État actuel:', isMenuOpen ? 'ouvert' : 'fermé');
            toggleMenu();
        });

        // Ferme si clic sur un lien
        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (isMobile() && isMenuOpen) {
                    closeMenu();
                }
            });
        });

        // Ferme si clic en dehors (avec délai pour éviter conflit)
        document.addEventListener('click', (e) => {
            if (isMobile() && isMenuOpen) {
                if (!nav.contains(e.target) && !toggle.contains(e.target)) {
                    closeMenu();
                }
            }
        });

        // Réapplique les styles au resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                applyMobileStyles();
            }, 100);
        });

        // Applique les styles initiaux
        applyMobileStyles();
        
        console.log('Menu mobile: initialisé avec succès!');
    }

    async loadAll() {
        await Promise.all([
            this.loadComponent('header', '#header-placeholder'),
            this.loadComponent('footer', '#footer-placeholder')
        ]);
    }
}

// Auto-initialisation
document.addEventListener('DOMContentLoaded', async () => {
    const loader = new ComponentLoader();
    await loader.loadAll();
    document.dispatchEvent(new CustomEvent('componentsLoaded'));
});

window.ComponentLoader = ComponentLoader;