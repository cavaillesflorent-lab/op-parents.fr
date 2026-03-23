// ============================================
// CONFIGURATION CENTRALISÉE - OP! Parents
// ============================================

const OP_CONFIG = {
    // Supabase
    supabase: {
        url: 'https://qjdoepgvqpmckqnxcsob.supabase.co',
        anonKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZG9lcGd2cXBtY2txbnhjc29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDIxNDgsImV4cCI6MjA4MjQxODE0OH0.EPY7Oo_MIcJp40PRpkQ3tV3O8KPG2wZGonVRd6XrmR4'
    },
    
    // Site
    site: {
        name: 'OP!',
        tagline: 'booste tes finances !',
        url: 'https://op-parents.fr'
    },
    
    // Réseaux sociaux
    social: {
        instagram: 'https://instagram.com/op.parents',
        linkedin: 'https://linkedin.com/company/op-parents'
    },
    
    // Meta Pixel
    meta: {
        pixelId: '925948590314572'
    }
};

// ============================================
// META PIXEL - Initialisation automatique
// ============================================
(function() {
    var pixelId = OP_CONFIG.meta.pixelId;
    
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    
    fbq('init', pixelId);
    fbq('track', 'PageView');
    
    console.log('✅ Meta Pixel initialisé (' + pixelId + ')');
})();

// ============================================
// SUPABASE - Initialisation
// ============================================
let supabaseClient = null;

function initSupabase() {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(
            OP_CONFIG.supabase.url, 
            OP_CONFIG.supabase.anonKey
        );
        window.supabaseClient = supabaseClient;
        console.log('✅ Supabase initialisé');
        return supabaseClient;
    } else {
        console.log('ℹ️ SDK Supabase non chargé (page publique)');
        return null;
    }
}

// Export pour utilisation globale
window.OP_CONFIG = OP_CONFIG;
window.initSupabase = initSupabase;