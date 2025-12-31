// ============================================
// CONFIGURATION CENTRALISÉE - OP! Parents
// ============================================
// ⚠️ REMPLACE CES VALEURS PAR TES CLÉS SUPABASE ⚠️

const OP_CONFIG = {
    // Supabase
    supabase: {
        url: 'https://qjdoepgvqpmckqnxcsob.supabase.co',      // Remplace XXXXX par ton URL
        anonKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZG9lcGd2cXBtY2txbnhjc29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDIxNDgsImV4cCI6MjA4MjQxODE0OH0.EPY7Oo_MIcJp40PRpkQ3tV3O8KPG2wZGonVRd6XrmR4'                      // Remplace par ta clé anon public
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
    }
};

// Initialisation Supabase (si le SDK est chargé)
let supabaseClient = null;

function initSupabase() {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(
            OP_CONFIG.supabase.url, 
            OP_CONFIG.supabase.anonKey
        );
        window.supabaseClient = supabaseClient; // Assigne aussi à window
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