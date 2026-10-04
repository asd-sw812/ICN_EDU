# 탄환덱 전투 캐릭터

기존 NovelAI 뒷모습 그림을 파츠로 나누고 Cubism 5.3.04에서 메쉬·Warp·파라미터를 작성했다. `live2d/`에는 실제 MOC3, 모델 설정, 2048px 텍스처를 포함한다. 첫 캐릭터는 개별 모델이고 나머지 세 명은 공용 파일에서 해당 ID의 파츠만 렌더링한다.

`live2d.js`는 현재 모델에 사용된 마스크 없는 일반 합성 메쉬를 WebGL로 표시한다. 호흡과 공격 반동을 MOC 파라미터로 구동하며 첫 캐릭터에는 머리 움직임도 있다. 감소된 연출/시스템 동작 줄이기 설정에서는 움직임을 멈춘다. 로딩 실패 시 뒷모습 정지 그림을 표시한다.

파츠 뒤쪽의 가려진 영역은 보완하지 않았으므로 변형 폭을 작게 제한했다. 새로운 전신 포즈나 머리카락 물리는 포함하지 않는다. `*-rear.webp`는 정지 그림과 하단 파티 슬롯용이다. 궁극기 컷인은 기존 편성 그림을 사용한다.

Cubism Core 6.0.1은 Live2D 공식 호스트에서 불러온다. Core를 포함하는 배포에는 [Live2D Proprietary Software License Agreement](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)가 적용된다. 편집 원본 CMO3/PSD는 로컬 `outputs/Live2D-bullet/`에 보관한다.
