// Configuration Supabase - OP! Parents
// Remplace ces valeurs par tes clés Supabase

const SUPABASE_URL = 'https://qjdoepgvqpmckqnxcsob.supabase.co'; // Remplace XXXXX par ton URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqZG9lcGd2cXBtY2txbnhjc29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDIxNDgsImV4cCI6MjA4MjQxODE0OH0.EPY7Oo_MIcJp40PRpkQ3tV3O8KPG2wZGonVRd6XrmR4'; 

// Initialisation du client Supabase v2
const { createClient } = supabase;
window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// Export pour utilisation dans d'autres fichiers
window.supabaseClient = supabase;