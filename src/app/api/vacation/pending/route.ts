import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    // Firestore에서 대기 중인 휴가 요청 가져오기
    const vacationsCollection = collection(db, 'vacations');
    const pendingQuery = query(
      vacationsCollection,
      where('status', '==', 'pending')
    );
    
    const querySnapshot = await getDocs(pendingQuery);
    
    const requests = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 날짜 기준으로 정렬 (최신 날짜가 위로)
    requests.sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return NextResponse.json({ requests }, { status: 200 });
  } catch (error) {
    console.error('대기 중인 휴가 요청 불러오기 오류:', error);
    return NextResponse.json(
      { error: '대기 중인 휴가 요청을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 