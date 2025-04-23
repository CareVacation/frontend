import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  
  if (!id) {
    return NextResponse.json(
      { error: '휴가 ID가 누락되었습니다' },
      { status: 400 }
    );
  }
  
  try {
    const vacationDocRef = doc(db, 'vacations', id);
    const vacationSnap = await getDoc(vacationDocRef);
    
    if (!vacationSnap.exists()) {
      return NextResponse.json(
        { error: '해당 휴가 신청을 찾을 수 없습니다' },
        { status: 404 }
      );
    }
    
    // 휴가 상태를 '승인됨'으로 업데이트
    await updateDoc(vacationDocRef, {
      status: 'approved',
      updatedAt: new Date().toISOString()
    });
    
    return NextResponse.json(
      { message: '휴가 신청이 승인되었습니다' },
      { status: 200 }
    );
  } catch (error) {
    console.error('휴가 승인 중 오류 발생:', error);
    return NextResponse.json(
      { error: '휴가 승인 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 