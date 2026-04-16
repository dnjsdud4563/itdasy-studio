function calculateTimeSaving() {
  const timePerPost = parseInt(document.getElementById('calc-time-per-post').value);
  const postsPerWeek = parseInt(document.getElementById('calc-posts-week').value);
  const editTime = parseInt(document.getElementById('calc-edit-time').value);
  
  const resultBox = document.getElementById('calc-result');
  const timeBeforeLabel = document.getElementById('time-before');
  const timeAfterLabel = document.getElementById('time-after');
  const barBefore = document.getElementById('bar-before');
  const barAfter = document.getElementById('bar-after');
  const laborCostSpan = document.getElementById('labor-cost');
  const valueRatioSpan = document.getElementById('value-ratio');

  // 한 달 기준 (4주) 소요 시간 계산
  const totalMinutesBefore = (timePerPost + editTime) * postsPerWeek * 4;
  const hoursBefore = (totalMinutesBefore / 60).toFixed(1);
  
  // 잇데이 사용 시 (포스트당 2분으로 단축)
  const hoursAfter = (postsPerWeek * 4 * 2 / 60).toFixed(1);
  
  // 시각화 비율 계산 (최대 100% 기준)
  const afterPercent = (hoursAfter / hoursBefore) * 100;

  timeBeforeLabel.innerText = `${hoursBefore}h`;
  timeAfterLabel.innerText = `${hoursAfter}h`;
  barAfter.style.height = `${afterPercent}%`;

  // 노동 가치 절감액 (시급 2만원 기준)
  const savedHours = parseFloat(hoursBefore) - parseFloat(hoursAfter);
  const savedCost = Math.floor(savedHours * 20000);
  const ratio = (savedCost / 3900).toFixed(0);

  laborCostSpan.innerText = `₩${savedCost.toLocaleString()}`;
  valueRatioSpan.innerText = ratio;

  resultBox.style.display = 'block';
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function generateAICaption() {
  const tone = document.getElementById('demo-tone').value;
  const tags = document.getElementById('demo-tags').value;
  const resultArea = document.getElementById('demo-result');
  const loading = document.getElementById('demo-loading');

  if (!tone || !tags) {
    alert('말투 예시와 해시태그를 입력해주세요!');
    return;
  }

  resultArea.style.display = 'none';
  loading.style.display = 'block';

  setTimeout(() => {
    loading.style.display = 'none';
    resultArea.style.display = 'block';

    const tagList = tags.split(',').map(t => `#${t.trim()}`).join(' ');
    
    let greeting = "안녕하세요! 오늘 소중한 발걸음 해주셔서 감사합니다. 😊";
    if (tone.includes('안녕') || tone.includes('원장님')) {
      greeting = tone.split('!')[0] + "!";
    }

    const caption = `${greeting}

원장님이 가장 자신 있어 하는 스타일, 
${tags.split(',')[0]} 스타일로 완벽하게 변신하셨어요. ✨

원장님만의 섬세한 터치와 감성으로 
고객님의 분위기가 한층 더 아름다워졌습니다. 

다음에도 더 예쁜 스타일로 보답할게요! 🌸

${tagList} #잇데이스튜디오 #AI마케팅 #뷰티샵성장`;

    resultArea.innerHTML = caption;
  }, 1500);
}
