import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// 기본 CORS 및 캐시 방지 헤더 설정
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// OPTIONS 요청에 대한 핸들러 추가
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

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
    
    return NextResponse.json({ requests }, { status: 200, headers });
  } catch (error) {
    console.error('휴가 요청 불러오기 오류:', error);
    return NextResponse.json(
      { error: '휴가 요청을 불러오는 중 오류가 발생했습니다.' },
      { status: 500, headers }
    );
  }
} 