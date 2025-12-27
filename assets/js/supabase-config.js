// Configuration Supabase - OP! Parents
// Remplace ces valeurs par tes clés Supabase

const SUPABASE_URL = 'https://qjdoepgvqpmckqnxcsob.supabase.co'; // Remplace XXXXX par ton URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZG9lcGd2cXBtY2txbnhjc29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDIxNDgsImV4cCI6MjA4MjQxODE0OH0.EPY7Oo_MIcJp40PRpkQ3tV3O8KPG2wZGonVRd6XrmR4'; 

// Vérification que Supabase est chargé
if (typeof supabase === 'undefined') {
    console.error('❌ Supabase SDK non chargé !');
} else {
    console.log('✅ Supabase SDK chargé');
    
    // Initialisation du client
    try {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Client Supabase initialisé');
    } catch (error) {
        console.error('❌ Erreur initialisation Supabase:', error);
    }
}