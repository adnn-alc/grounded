import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { applyCachedAppearance } from './data/fonts.js'
import './styles/global.css'

// Paint with the last-used theme and fonts while settings load from the API
applyCachedAppearance()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
