import type { APIRoute } from 'astro';
import { insertItem, deleteItem, updateItem } from '../../lib/db';

export const POST: APIRoute = async ({ request, cookies }) => {
  // Check auth
  const sessionCookie = cookies.get('session');
  if (!sessionCookie) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { name, category, price, isNew, image_url, aff_url, tkp_url } = await request.json();
    if (!name || !category || price === undefined || !image_url || !aff_url) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const insertedId = await insertItem(
      name,
      category,
      parseFloat(price),
      Boolean(isNew),
      image_url,
      aff_url,
      tkp_url || ''
    );

    return new Response(JSON.stringify({ success: true, id: insertedId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[API Product POST Error]', error);
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
      return new Response(JSON.stringify({ error: 'Missing product id parameter' }), { status: 400 });
    }

    const id = parseInt(idStr, 10);
    await deleteItem(id);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[API Product DELETE Error]', error);
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
    const { id, name, category, price, isNew, image_url, aff_url, tkp_url } = await request.json();
    if (!id || !name || !category || price === undefined || !image_url || !aff_url) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    await updateItem(
      parseInt(id, 10),
      name,
      category,
      parseFloat(price),
      Boolean(isNew),
      image_url,
      aff_url,
      tkp_url || ''
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[API Product PUT Error]', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
