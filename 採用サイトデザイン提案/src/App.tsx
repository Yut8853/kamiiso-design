const BASE = 'https://kamiiso-v5.vercel.app/assets/'

const envPhotos = [
  { src: `${BASE}0004-BYufnV8c.webp`, alt: '工場での作業風景' },
  { src: `${BASE}0009-Dmte3G1d.webp`, alt: '職場環境' },
  { src: `${BASE}0028-_ks1NIBr.webp`, alt: '製造現場' },
  { src: `${BASE}0044-BFB1ueTH.webp`, alt: 'オペレーターの作業' },
  { src: `${BASE}0048-9_IQPKva.webp`, alt: '製造ラインの様子' },
  { src: `${BASE}0083-BHZTvX8n.webp`, alt: '職場での打ち合わせ' },
  { src: `${BASE}0092-B87_yqhW.webp`, alt: '従業員の働く様子' },
]

const officePhotos = [
  { src: `${BASE}1001-CgKdM70Y.webp`, alt: '社屋外観' },
  { src: `${BASE}1002-Cl-OA34_.webp`, alt: 'オフィス内部' },
  { src: `${BASE}1003-CH2RPlJH.webp`, alt: '会議室' },
  { src: `${BASE}1004-DLzChc_N.webp`, alt: '執務スペース' },
  { src: `${BASE}1005-DnyJ7r1j.webp`, alt: '休憩スペース' },
  { src: `${BASE}1006-DP-jO6R1.webp`, alt: 'エントランス' },
  { src: `${BASE}1007-CQ7w-wTj.webp`, alt: '廊下' },
  { src: `${BASE}1008-TvoZIiPo.webp`, alt: '建物内部' },
  { src: `${BASE}1009-eqUwb_CA.webp`, alt: '設備' },
  { src: `${BASE}1010-Cfwgrydi.webp`, alt: 'オフィス2' },
  { src: `${BASE}1011-DsRnx_08.webp`, alt: '外観2' },
]

const exhibPhotos = [
  { src: `${BASE}0109-DbpVyduX.webp`, alt: '展示会に並ぶカミイソの商品' },
  { src: `${BASE}0112-CkgQPNre.webp`, alt: '展示会のカミイソブースとマスキングテープ' },
]

function Img({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" />
}

function Ph({ bg = '#cfc8bc' }: { bg?: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: bg }}>
      <span style={{ fontSize: 10, letterSpacing: '0.3em', color: '#9a8e82', fontFamily: 'var(--font-sans)' }}>
        写真（仮）
      </span>
    </div>
  )
}

function Label({ text, red = false }: { text: string; red?: boolean }) {
  return (
    <p
      style={{
        fontSize: 10,
        letterSpacing: '0.38em',
        color: red ? '#c5282a' : '#c5282a',
        textTransform: 'uppercase',
        marginBottom: '1rem',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {text}
    </p>
  )
}

/* ═══════════════════════════════════════════════════════════
   1. 働く環境
   骨格: 左右に背の高い縦アンカー、内側で高さが変わる非均等モザイク
         視線が左→右→中央下と三角形を描く
   ═══════════════════════════════════════════════════════════ */
function EnvironmentSection() {
  return (
    <section id="environment" className="bg-[#f5f0e6] pt-24 pb-20">
      <div className="max-w-[1240px] mx-auto px-6 lg:px-16">

        {/* Intro: label → heading (full width) → body text (contained right) */}
        <div className="mb-10 lg:mb-14">
          <Label text="ENVIRONMENT" />
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 lg:gap-16">
            <h2
              className="font-serif text-[#1a1510] leading-[1.15] flex-shrink-0"
              style={{ fontSize: 'clamp(2rem, 2.8vw, 2.8rem)' }}
            >
              働く環境
            </h2>
            <p
              className="text-[13.5px] leading-[2.1] text-[#4a3e34] lg:max-w-[520px]"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              私たちは、製品のクオリティに絶対の自信を持っています。根拠に基づき、柔軟なアイデアから数々の製品を生み出してきましたが、どれだけ良いアイデアがあっても生産できなければ意味がありません。工場オペレーターは、生産という「カタチにすること」を担い、モノの提供を会社の最前線で行っていく、重要な役割になります。
            </p>
          </div>
        </div>

        {/* Desktop: 4-col asymmetric mosaic
            0004: col1, row1-2  — tall left anchor
            0009: col2, row1    — upper center-left
            0028: col3, row1    — upper center-right
            0044: col4, row1-2  — tall right anchor
            0048: col2-3, row2  — wide center bridge
            0083: col1-3, row3  — wide bottom-left
            0092: col4,   row3  — bottom-right accent
        */}
        <div
          className="hidden sm:grid"
          style={{
            gridTemplateColumns: '2.4fr 1fr 1fr 1.6fr',
            gridTemplateRows: '290px 210px 210px',
            gap: '6px',
          }}
        >
          {[
            { photo: envPhotos[0], col: '1',     row: '1 / 3' },
            { photo: envPhotos[1], col: '2',     row: '1'     },
            { photo: envPhotos[2], col: '3',     row: '1'     },
            { photo: envPhotos[3], col: '4',     row: '1 / 3' },
            { photo: envPhotos[4], col: '2 / 4', row: '2'     },
            { photo: envPhotos[5], col: '1 / 3', row: '3'     },
            { photo: envPhotos[6], col: '3 / 5', row: '3'     },
          ].map(({ photo, col, row }) => (
            <div
              key={photo.src}
              className="overflow-hidden bg-[#ddd5c5]"
              style={{ gridColumn: col, gridRow: row }}
            >
              <Img src={photo.src} alt={photo.alt} />
            </div>
          ))}
        </div>

        {/* Mobile: 2-col stack */}
        <div className="grid grid-cols-2 gap-[6px] sm:hidden">
          <div className="col-span-2 h-[260px] overflow-hidden bg-[#ddd5c5]">
            <Img src={envPhotos[0].src} alt={envPhotos[0].alt} />
          </div>
          {envPhotos.slice(1).map((p) => (
            <div key={p.src} className="h-[150px] overflow-hidden bg-[#ddd5c5]">
              <Img src={p.src} alt={p.alt} />
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════
   2. 社屋・オフィス（既存スライダー維持）
   ═══════════════════════════════════════════════════════════ */
function OfficeSection() {
  const all = [...officePhotos, ...officePhotos]
  return (
    <section id="office" className="py-24 bg-white">
      <div className="max-w-[1240px] mx-auto px-6 lg:px-16 mb-10">
        <Label text="OFFICE SCENES" />
        <h2
          className="font-serif text-[#1a1510] leading-[1.15]"
          style={{ fontSize: 'clamp(2rem, 2.8vw, 2.8rem)' }}
        >
          社屋・オフィス
        </h2>
      </div>
      <div className="overflow-hidden">
        <div
          className="flex"
          style={{ animation: 'slide-infinite 38s linear infinite', width: 'max-content', gap: '6px' }}
        >
          {all.map((photo, i) => (
            <div
              key={i}
              className="flex-shrink-0 overflow-hidden bg-[#ddd5c5]"
              style={{ width: '360px', height: '256px' }}
            >
              <Img src={photo.src} alt={photo.alt} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════
   3. 展示会
   骨格: 見出しを左列に縦置き、写真グリッドを右列に展開
         主役(0109)が左縦スパン、右に実写1枚+仮枠2枚が段積み
         最下段は仮枠1枚が横断してリズムを締める
   ═══════════════════════════════════════════════════════════ */
function ExhibitionSection() {
  return (
    <section id="exhibition" className="bg-[#f5f0e6] pt-24 pb-20">
      <div className="max-w-[1240px] mx-auto px-6 lg:px-16">

        {/* Desktop: heading left column + photo grid right */}
        <div className="hidden lg:grid gap-12" style={{ gridTemplateColumns: '1fr 3fr' }}>

          {/* Sticky-ish heading */}
          <div className="pt-2">
            <Label text="EXHIBITION" />
            <h2
              className="font-serif text-[#1a1510] leading-[1.2]"
              style={{ fontSize: 'clamp(2rem, 2.8vw, 2.8rem)' }}
            >
              展示会などでも{'\n'}出店しています
            </h2>
          </div>

          {/* Photo grid
              0109: col1, row1-2     — tall left
              0112: col2-3, row1     — wide upper-right
              ph1:  col2, row2       — lower center
              ph2:  col3, row2       — lower right
              ph3:  col1-3, row3     — full-width anchor strip
          */}
          <div>
            <div
              className="grid"
              style={{
                gridTemplateColumns: '1.6fr 1fr 1fr',
                gridTemplateRows: '260px 180px 150px',
                gap: '6px',
              }}
            >
              {[
                { el: <Img src={exhibPhotos[0].src} alt={exhibPhotos[0].alt} />, col: '1',     row: '1 / 3', bg: '#ddd5c5' },
                { el: <Img src={exhibPhotos[1].src} alt={exhibPhotos[1].alt} />, col: '2 / 4', row: '1',     bg: '#ddd5c5' },
                { el: <Ph bg="#d4ccc0" />,                                       col: '2',     row: '2',     bg: '#d4ccc0' },
                { el: <Ph bg="#ccc4b8" />,                                       col: '3',     row: '2',     bg: '#ccc4b8' },
                { el: <Ph bg="#c8c0b4" />,                                       col: '1 / 4', row: '3',     bg: '#c8c0b4' },
              ].map(({ el, col, row, bg }, i) => (
                <div
                  key={i}
                  className="overflow-hidden"
                  style={{ gridColumn: col, gridRow: row, backgroundColor: bg }}
                >
                  {el}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Mobile */}
        <div className="lg:hidden">
          <Label text="EXHIBITION" />
          <h2
            className="font-serif text-[#1a1510] leading-[1.2] mb-8"
            style={{ fontSize: 'clamp(2rem, 2.8vw, 2.8rem)' }}
          >
            展示会などでも出店しています
          </h2>
          <div className="grid grid-cols-1 gap-[6px]">
            <div className="h-[280px] overflow-hidden bg-[#ddd5c5]">
              <Img src={exhibPhotos[0].src} alt={exhibPhotos[0].alt} />
            </div>
            <div className="grid grid-cols-2 gap-[6px]">
              <div className="h-[180px] overflow-hidden bg-[#ddd5c5]">
                <Img src={exhibPhotos[1].src} alt={exhibPhotos[1].alt} />
              </div>
              <div className="h-[180px]"><Ph bg="#d4ccc0" /></div>
            </div>
            <div className="grid grid-cols-2 gap-[6px]">
              <div className="h-[150px]"><Ph bg="#ccc4b8" /></div>
              <div className="h-[150px]"><Ph bg="#c8c0b4" /></div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════
   4. 海外展開
   骨格: 左上ワイド+右縦スパン+左下2枚の L字構成
         ダーク背景で章の転換を作る
   ═══════════════════════════════════════════════════════════ */
function GlobalSection() {
  const darkBg = 'transparent'
  const phColors = ['#ddd5c5', '#d4ccc0', '#ccc4b8', '#c8c0b4']

  return (
    <section id="global" className="py-24 bg-white">
      <div className="max-w-[1240px] mx-auto px-6 lg:px-16">

        <div className="mb-12">
          <Label text="GLOBAL" />
          <h2
            className="font-serif leading-[1.15]"
            style={{ fontSize: 'clamp(2rem, 2.8vw, 2.8rem)', color: '#1a1510' }}
          >
            カミイソの海外展開
          </h2>
        </div>

        {/* Desktop: L字構成
            ph1: col1-2, row1  — wide top-left
            ph2: col3, row1-2  — tall right anchor
            ph3: col1, row2    — lower-left
            ph4: col2, row2    — lower-center
        */}
        <div
          className="hidden sm:grid"
          style={{
            gridTemplateColumns: '1fr 1fr 1.2fr',
            gridTemplateRows: '280px 200px',
            gap: '6px',
          }}
        >
          {[
            { col: '1 / 3', row: '1',     bg: phColors[0] },
            { col: '3',     row: '1 / 3', bg: phColors[1] },
            { col: '1',     row: '2',     bg: phColors[2] },
            { col: '2',     row: '2',     bg: phColors[3] },
          ].map(({ col, row, bg }, i) => (
            <div
              key={i}
              className="overflow-hidden"
              style={{ gridColumn: col, gridRow: row, backgroundColor: bg }}
            >
              <Ph bg={bg} />
            </div>
          ))}
        </div>

        {/* Mobile */}
        <div className="grid grid-cols-2 gap-[6px] sm:hidden">
          <div className="col-span-2 h-[220px]"><Ph bg={phColors[0]} /></div>
          <div className="h-[160px]"><Ph bg={phColors[1]} /></div>
          <div className="h-[160px]"><Ph bg={phColors[2]} /></div>
          <div className="col-span-2 h-[160px]"><Ph bg={phColors[3]} /></div>
        </div>

      </div>
    </section>
  )
}

export default function App() {
  return (
    <div>
      <EnvironmentSection />
      <OfficeSection />
      <ExhibitionSection />
      <GlobalSection />
    </div>
  )
}
