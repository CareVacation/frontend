import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function DELETE(
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
    
    // 휴가 요청 삭제
    await deleteDoc(vacationDocRef);
    
    return NextResponse.json(
      { message: '휴가 신청이 삭제되었습니다' },
      { status: 200 }
    );
  } catch (error) {
    console.error('휴가 삭제 중 오류 발생:', error);
    return NextResponse.json(
      { error: '휴가 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 