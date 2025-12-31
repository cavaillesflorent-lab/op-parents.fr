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
        
        if (toggle && nav) {
            toggle.addEventListener('click', () => {
                nav.classList.toggle('nav-open');
                toggle.classList.toggle('active');
            });
        }
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