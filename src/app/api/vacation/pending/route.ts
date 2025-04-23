import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    // Firestore에서 모든 휴가 요청 가져오기
    const vacationsCollection = collection(db, 'vacations');
    
    // 날짜 기준으로 정렬된 쿼리 (최신순)
    const querySnapshot = await getDocs(
      query(vacationsCollection, orderBy('createdAt', 'desc'))
    );
    
    const requests = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return NextResponse.json({ requests }, { status: 200 });
  } catch (error) {
    console.error('휴가 요청 불러오기 오류:', error);
    return NextResponse.json(
      { error: '휴가 요청을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 