import { useState, useCallback } from 'react'
import { Clock, AlertCircle } from 'lucide-react'
import ProfileInput from './components/ProfileInput'
import ResultsPanel from './components/ResultsPanel'
import LoadingScreen from './components/LoadingScreen'
import HistoryDrawer from './components/HistoryDrawer'
import { analyzeProfile, saveToHistory, getHistory, getRemainingAnalyses, recordAnalysis } from './lib/roastEngine'

const STATES = { idle: 'idle', loading: 'loading', results: 'results', error: 'error' }

export default function App() {
  const [appState, setAppState] = useState(STATES.idle)
  const [result, setResult] = useState(null)
  const [activeMode, setActiveMode] = useState('both')
  const [errorMessage, setErrorMessage] = useState('')
  const [history, setHistory] = useState(getHistory)
  const [showHistory, setShowHistory] = useState(false)
  const [remaining, setRemaining] = useState(getRemainingAnalyses)

  const handleSubmit = useCallback(async ({ profileText, mode, tone, targetRole }) => {
    setAppState(STATES.loading)
    setActiveMode(mode)
    setErrorMessage('')
    try {
      const data = await analyzeProfile({ profileText, mode, tone, targetRole })
      recordAnalysis()
      saveToHistory(data, profileText, mode)
      setHistory(getHistory())
      setRemaining(getRemainingAnalyses())
      setResult(data)
      setAppState(STATES.results)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.')
      setAppState(STATES.error)
    }
  }, [])

  function handleReset() {
    setAppState(STATES.idle)
    setResult(null)
    setErrorMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleHistorySelect(res, mode) {
    setResult(res)
    setActiveMode(mode)
    setAppState(STATES.results)
  }

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b-2 border-stone-900 shadow-[0_2px_0_#1c1917]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <span className="font-black text-stone-900 tracking-tight text-lg">LinkedIn Roaster</span>
            <span className="hidden sm:inline text-xs bg-orange-100 text-orange-700 border border-orange-300 rounded-full px-2 py-0.5 font-semibold">BETA</span>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors border border-stone-300 rounded-lg px-3 py-1.5 hover:border-stone-500 bg-white"
          >
            <Clock size={13} />
            History
            {history.length > 0 && (
              <span className="ml-0.5 rounded-full bg-orange-500 text-white text-[10px] w-4 h-4 flex items-center justify-center font-bold">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 pb-20">
        {/* Hero */}
        {(appState === STATES.idle || appState === STATES.error) && (
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔥💀🔥</div>
            <h1 className="text-3xl sm:text-4xl font-black text-stone-900 leading-tight mb-3">
              Your LinkedIn called.<br />
              <span className="text-orange-500">It wants therapy.</span>
            </h1>
            <p className="text-stone-500 text-sm max-w-sm mx-auto font-medium">
              Paste your LinkedIn URL. Get a brutally honest roast + real career advice. No login. No mercy.
            </p>
          </div>
        )}

        {/* Error banner */}
        {appState === STATES.error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Something went wrong</p>
              <p className="text-sm text-red-600 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* States */}
        {(appState === STATES.idle || appState === STATES.error) && (
          <div className="bg-white rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0_#1c1917] p-6">
            <ProfileInput onSubmit={handleSubmit} remaining={remaining} />
          </div>
        )}

        {appState === STATES.loading && <LoadingScreen />}

        {appState === STATES.results && result && (
          <ResultsPanel result={result} mode={activeMode} onReset={handleReset} />
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 border-t-2 border-stone-200">
        <p className="text-xs text-stone-400 font-medium">
          Profile text not stored · 
          <a href="#" className="underline ml-1 hover:text-stone-600">Privacy</a>
        </p>
      </footer>

      {showHistory && (
        <HistoryDrawer
          history={history}
          onSelect={handleHistorySelect}
          onClose={() => setShowHistory(false)}
          onClear={() => setHistory([])}
        />
      )}
    </div>
  )
}
