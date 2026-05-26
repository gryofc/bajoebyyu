import type { APIRoute } from 'astro';
import { insertBlog, deleteBlog, updateBlog } from '../../lib/db';

export const POST: APIRoute = async ({ request, cookies }) => {
  // Check auth
  const sessionCookie = cookies.get('session');
  if (!sessionCookie) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { title, category, status, content } = await request.json();
    if (!title || !category || !status) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const insertedId = await insertBlog(title, category, status, content || '');
    return new Response(JSON.stringify({ success: true, id: insertedId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[API Blog POST Error]', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  // Check auth
  const sessionCookie = cookies.get('session');
  if (!sessionCookie) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const idStr = url.searchParams.get('id');
    if (!idStr) {
      return new Response(JSON.stringify({ error: 'Missing blog id parameter' }), { status: 400 });
    }

    const id = parseInt(idStr, 10);
    await deleteBlog(id);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[API Blog DELETE Error]', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  // Check auth
  const sessionCookie = cookies.get('session');
  if (!sessionCookie) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { id, title, category, status, content } = await request.json();
    if (!id || !title || !category || !status) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    await updateBlog(parseInt(id, 10), title, category, status, content || '');
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[API Blog PUT Error]', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
