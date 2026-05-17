import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zasxmucvaybldcjiwjnv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inphc3htdWN2YXlibGRjaml3am52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NjAyNzAsImV4cCI6MjA5NDUzNjI3MH0.QJ1rGhRO3ehqLQEvCNy3AMsqePXQwcsRjVKmNOIRPiU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
