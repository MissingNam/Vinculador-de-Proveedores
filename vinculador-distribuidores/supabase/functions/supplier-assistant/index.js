import { createClient } from 'npm:@supabase/supabase-js@2'
import { createHandler } from './handler.js'

Deno.serve(createHandler({
  env: name => Deno.env.get(name),
  createClient,
  fetchImpl: fetch,
}))
