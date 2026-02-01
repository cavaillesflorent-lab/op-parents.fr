// ============================================
// CHARGEUR DE COMPOSANTS - OP! Parents
// Version simplifiée et robuste
// ============================================

class ComponentLoader {
    constructor() {
        this.basePath = this.getBasePath();
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
            
            // Initialiser le menu mobile après chargement du header
            if (componentName === 'header') {
                this.initMobileMenu();
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
        const toggle = document.getElementById('mobile-toggle');
        const nav = document.getElementById('main-nav');
        
        if (!toggle || !nav) {
            console.warn('Menu mobile: éléments non trouvés');
            return;
        }

        // Supprimer les anciens event listeners (au cas où)
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);

        // État du menu
        let isOpen = false;

        // Fonction pour ouvrir le menu
        const openMenu = () => {
            isOpen = true;
            nav.classList.add('is-open');
            newToggle.classList.add('is-active');
            newToggle.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
        };

        // Fonction pour fermer le menu
        const closeMenu = () => {
            isOpen = false;
            nav.classList.remove('is-open');
            newToggle.classList.remove('is-active');
            newToggle.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        };

        // Toggle au clic sur le bouton hamburger
        newToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        // Fermer au clic sur un lien
        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    closeMenu();
                }
            });
        });

        // Fermer au clic en dehors
        document.addEventListener('click', (e) => {
            if (isOpen && !nav.contains(e.target) && !newToggle.contains(e.target)) {
                closeMenu();
            }
        });

        // Fermer avec Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                closeMenu();
            }
        });

        // Fermer au resize si on passe en desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && isOpen) {
                closeMenu();
            }
        });

        console.log('✅ Menu mobile initialisé');
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