import { useEffect, useState, useRef } from 'react';
import Papa from 'papaparse';
import ReactPlayer from 'react-player';

const CSV_URL = './hitster-de.csv';
const STORAGE_KEY = 'hitster-session';

function shuffle(arr) {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export default function App() {
	const [loading, setLoading] = useState(true);
	const [rows, setRows] = useState([]);
	const [order, setOrder] = useState([]);
	const [index, setIndex] = useState(0);
	const [revealed, setRevealed] = useState(false);
	const playerRef = useRef(null);
	const [playing, setPlaying] = useState(true);
	const [volume, setVolume] = useState(0.8);
	const [videoLoading, setVideoLoading] = useState(true);
	// ensure that restoring the session runs only once (bypass StrictMode double run)
	const restoredRef = useRef(false);

	useEffect(() => {
		if (restoredRef.current) return;
		restoredRef.current = true;

		let saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				// only restore when rows and order are non-empty arrays
				if (parsed &&
					Array.isArray(parsed.rows) &&
					parsed.rows.length > 0 &&
					Array.isArray(parsed.order) &&
					parsed.order.length > 0 &&
					typeof parsed.index === 'number'
				) {
					setOrder(parsed.order);
					setIndex(parsed.index);
					setRows(parsed.rows);
					setLoading(false);
					// persist immediately to avoid races from StrictMode double-invocation
					localStorage.setItem(STORAGE_KEY, JSON.stringify({
						order: parsed.order,
						index: parsed.index,
						rows: parsed.rows
					}));
					return;
				}
			} catch (e) {
				console.warn('failed to load session', e);
			}
		}

		Papa.parse(CSV_URL, {
			download: true,
			header: true,
			skipEmptyLines: true,
			complete: (result) => {
				const data = result.data;
				const mapped = data
					.map((r, i) => ({
						id: String(i + 1),
						Artist: r['Artist'] || r['artist'] || '',
						Title: r['Title'] || r['title'] || '',
						URL: (r['URL'] || r['Url'] || r['url'] || '').replace(/\s+/g, ''),
						Year: r['Year'] || r['year'] || ''
					}))
					.filter((r) => r.URL);

				setRows(mapped);
				const ord = shuffle(mapped.map((_, i) => i));
				setOrder(ord);
				setIndex(0);
				setLoading(false);
				localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: ord, index: 0, rows: mapped }));
			}
		});
	}, []);

	// persist session whenever order/index/rows change
	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ order, index, rows }));
	}, [order, index, rows]);

	const startNew = async () => {
		if (rows.length === 0) return;
		const ord = shuffle(rows.map((_, i) => i));
		setOrder(ord);
		setIndex(0);
		setRevealed(false);
		setVideoLoading(true);
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: ord, index: 0, rows }));
	};

	const next = () => {
		if (order.length === 0) return;
		setRevealed(false);
		setVideoLoading(true);
		setIndex(prevIndex => {
			const updatedIndex = Math.min(prevIndex + 1, Math.max(0, order.length - 1));
			return updatedIndex;
		});
	};

	const current = rows[order[index]];

	return (
		<div className='app'>
			<header className='top'>
				<h1>Hitster Trainer</h1>
				<div className='controls'>
					<button onClick={startNew} className='btn primary'>Start New Session</button>
				</div>
			</header>

			<main className='content'>
				{loading && <div className='card'>Loading CSV…</div>}
				{!loading && (!current) && <div className='card'>No more cards. Start a new session.</div>}

				{!loading && current && (
					<div className='card'>
						{/* hidden player: we keep the iframe hidden to avoid revealing thumbnails/titles
								but control playback and volume via our custom UI */}
						<div className='player' aria-hidden>
							{/* show spinner while the youtube player is loading/buffering in background */}
							{videoLoading && <div className='spinner' role='status' aria-label='loading' />}
							<ReactPlayer
								ref={(r) => (playerRef.current = r)}
								url={current.URL}
								playing={playing}
								controls={false}
								volume={volume}
								width={0}
								height={0}
								style={{ display: 'none' }}
								onReady={() => setVideoLoading(false)}
								onStart={() => setVideoLoading(false)}
								onPlay={() => setVideoLoading(false)}
								onBuffer={() => setVideoLoading(true)}
								onBufferEnd={() => setVideoLoading(false)}
								onError={() => setVideoLoading(false)}
								config={{
									youtube: {
										playerVars: {
											modestbranding: 1,
											rel: 0
										}
									}
								}}
							/>

							<div className='player-controls'>
								<button className='btn' onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>

								<label className='volume'>
									Volume
									<input type='range' min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
								</label>
							</div>
						</div>

						<div className='meta'>
							<div className='hint'>Listen and guess the song/year</div>
							{revealed ? (
								<div className='info'>
									<div className='artist'>{current.Artist}</div>
									<div className='title'>{current.Title}</div>
									<div className='year'>{current.Year}</div>
								</div>
							) : (
								<div className='hidden'>Info hidden</div>
							)}

							<div className='actions'>
								{!revealed && <button className='btn' onClick={() => setRevealed(true)}>Reveal</button>}
								{revealed && <button className='btn' onClick={next}>Next</button>}
							</div>
						</div>
					</div>
				)}
			</main>

			<footer className='foot'>Session progress: {rows.length ? `${Math.min(index + 1, order.length)}/${order.length}` : '0/0'}</footer>
		</div>
	);
}
