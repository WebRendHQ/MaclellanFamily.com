import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebase-admin';
import { syncDropboxToS3 } from '../../../lib/dropbox-sync';

// Dropbox webhook verification: responds with the challenge parameter
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('challenge');
  if (!challenge) {
    return new NextResponse('Bad Request', { status: 400 });
  }
  return new NextResponse(challenge, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
}

// Dropbox webhook events delivery (notifications only; actual sync handled by separate endpoint/worker)
export async function POST(request: NextRequest) {
  try {
    // Kick off sync using stored userFolderPath; respond immediately
    // Fire and forget (no await) to minimize webhook latency
    adminDb.collection('integrations').doc('dropbox').get().then((doc) => {
      const userFolderPath = doc.exists ? (doc.data()?.userFolderPath as string | undefined) : undefined;
      if (userFolderPath) {
        syncDropboxToS3({ userFolderPath, pathPrefix: '0 US', recursive: true }).catch(() => {});
      }
    }).catch(() => {});
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    return new NextResponse('Error', { status: 500 });
  }
}


