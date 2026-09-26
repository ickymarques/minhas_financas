import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const respond = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405);
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return respond({ error: 'Entre na sua conta.' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
  if (!url || !secret) return respond({ error: 'Serviço indisponível.' }, 503);
  const db = createClient(url, secret, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return respond({ error: 'Sessão inválida.' }, 401);

  let reportId: string;
  try { reportId = String((await request.json()).report_id || ''); } catch { return respond({ error: 'Pedido inválido.' }, 400); }
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(reportId)) return respond({ error: 'Pedido inválido.' }, 400);
  const { data: report, error: reportError } = await db.from('issue_reports').select('id,user_id,message,created_at,email_status').eq('id', reportId).maybeSingle();
  if (reportError || !report) return respond({ error: 'Relato não encontrado.' }, 404);
  if (report.user_id !== user.id) {
    const { data: admin } = await db.from('app_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!admin) return respond({ error: 'Acesso negado.' }, 403);
  }
  if (report.email_status === 'sent' || report.email_status === 'sending') return respond({ email_status: report.email_status });

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return respond({ email_status: 'pending', error: 'Envio por e-mail ainda não configurado.' }, 503);
  const { data: admins, error: adminError } = await db.from('app_admins').select('user_id').limit(1);
  const adminId = admins?.[0]?.user_id;
  const { data: adminProfile, error: emailError } = adminId ? await db.from('app_users').select('email').eq('user_id', adminId).maybeSingle() : { data: null, error: null };
  if (adminError || emailError || !adminProfile?.email) return respond({ email_status: 'pending', error: 'Destinatário não configurado.' }, 503);

  const { data: claimed, error: claimError } = await db.from('issue_reports').update({ email_status: 'sending' }).eq('id', report.id).eq('email_status', report.email_status).select('id').maybeSingle();
  if (claimError) return respond({ error: 'Não foi possível preparar o aviso.' }, 503);
  if (!claimed) return respond({ email_status: 'sending' }, 202);

  try {
    const { data: reporter } = await db.from('app_users').select('email,display_name').eq('user_id', report.user_id).maybeSingle();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('REPORT_EMAIL_FROM') || 'Meu Financeiro <onboarding@resend.dev>',
        to: [adminProfile.email],
        subject: 'Novo erro relatado no Meu Financeiro',
        text: `Relato de ${reporter?.display_name || reporter?.email || 'Usuário'} (${reporter?.email || 'sem e-mail'})\nData: ${new Date(report.created_at).toLocaleString('pt-BR')}\n\n${report.message}`
      })
    });
    if (!response.ok) throw new Error(`Falha do serviço de e-mail: ${response.status}`);
    const { error: updateError } = await db.from('issue_reports').update({ email_status: 'sent', email_sent_at: new Date().toISOString() }).eq('id', report.id);
    if (updateError) throw updateError;
    return respond({ email_status: 'sent' });
  } catch (error) {
    console.error('Falha ao notificar relato:', error);
    await db.from('issue_reports').update({ email_status: 'failed' }).eq('id', report.id);
    return respond({ email_status: 'failed', error: 'O relato foi salvo, mas o aviso por e-mail falhou.' }, 502);
  }
});
