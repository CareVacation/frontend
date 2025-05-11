import { NextResponse } from 'next/server';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Next.js 15.3.1에서는 라우트 파라미터 처리 방식이 변경됨
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  if (!id) {
    return NextResponse.json(
      { error: '휴가 ID가 누락되었습니다' },
      { status: 400 }
    );
  }
  
  try {
    // 요청 본문에서 비밀번호와 관리자 여부 추출
    const requestData = await request.json().catch(() => ({}));
    const { password, isAdmin } = requestData;
    
    const vacationDocRef = doc(db, 'vacations', id);
    const vacationSnap = await getDoc(vacationDocRef);
    
    if (!vacationSnap.exists()) {
      return NextResponse.json(
        { error: '해당 휴가 신청을 찾을 수 없습니다' },
        { status: 404 }
      );
    }
    
    const vacationData = vacationSnap.data();
    
    // 관리자가 아닌 경우에만 비밀번호 검증
    if (!isAdmin) {
      if (!password || !password.trim()) {
        return NextResponse.json(
          { error: '비밀번호가 필요합니다' },
          { status: 400 }
        );
      }
      
      console.log('삭제 요청 정보:', {
        id,
        inputPassword: password,
        storedPassword: vacationData.password,
        passwordMatch: vacationData.password === password,
        vacationUser: vacationData.userName,
        vacationDate: vacationData.date,
        isAdmin
      });
      
      // 비밀번호 검증
      if (vacationData.password !== password) {
        return NextResponse.json(
          { error: '비밀번호가 일치하지 않습니다' },
          { status: 403 }
        );
      }
    } else {
      console.log('관리자 권한으로 휴가 삭제 요청:', {
        id,
        vacationUser: vacationData.userName,
        vacationDate: vacationData.date
      });
    }
    
    // 휴가 문서 삭제
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