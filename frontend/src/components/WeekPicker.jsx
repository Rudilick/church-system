import { useState } from 'react'
import dayjs from 'dayjs'
import styles from './WeekPicker.module.css'

export function toThisSunday() {
  return dayjs().startOf('week').format('YYYY-MM-DD')
}

export function weekLabel(sundayStr) {
  const sun = dayjs(sundayStr)
  if (sun.month() === 11 && sun.date() === 25) {
    return `${sun.year()}년 성탄예배 (12월 25일)`
  }
  const weekNum = Math.ceil(sun.date() / 7)
  return `${sun.year()}년 ${sun.month() + 1}월 ${weekNum}주차 (${sun.month() + 1}월 ${sun.date()}일)`
}

function getSundaysInMonth(year, month) {
  const sundays = []
  const d = new Date(Date.UTC(year, month - 1, 1))
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCMonth() === month - 1) {
    sundays.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 7)
  }
  if (month === 12) {
    const christmas = `${year}-12-25`
    if (!sundays.includes(christmas)) {
      sundays.push(christmas)
      sundays.sort()
    }
  }
  return sundays
}

export default function WeekPicker({ current, onSelect }) {
  const cur = dayjs(current)
  const [view, setView] = useState('week')
  const [pYear, setPYear] = useState(cur.year())
  const [pMonth, setPMonth] = useState(cur.month() + 1)
  const [decadeStart, setDecadeStart] = useState(Math.floor(cur.year() / 10) * 10)

  const adjMonth = delta => {
    const d = dayjs(`${pYear}-${String(pMonth).padStart(2, '0')}-01`).add(delta, 'month')
    setPYear(d.year()); setPMonth(d.month() + 1)
  }

  if (view === 'week') {
    const sundays = getSundaysInMonth(pYear, pMonth)
    return (
      <div className={styles.picker}>
        <div className={styles.pickerNav}>
          <button className={styles.pickerArrow} onClick={() => adjMonth(-1)}>◀</button>
          <button className={styles.pickerDrillUp} onClick={() => setView('month')}>{pYear}년 {pMonth}월 ↑</button>
          <button className={styles.pickerArrow} onClick={() => adjMonth(1)}>▶</button>
        </div>
        <div className={styles.pickerWeeks}>
          {sundays.map(s => {
            const d = dayjs(s)
            const isChristmas = d.month() === 11 && d.date() === 25
            const wn = Math.ceil(d.date() / 7)
            return (
              <button key={s} className={`${styles.pickerWeekRow} ${s === current ? styles.pickerActive : ''}`} onClick={() => onSelect(s)}>
                <strong>{isChristmas ? '성탄예배' : `${wn}주차`}</strong>
                <span className={styles.pickerWeekDate}>({pMonth}월 {d.date()}일)</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (view === 'month') {
    const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
    return (
      <div className={styles.picker}>
        <div className={styles.pickerNav}>
          <button className={styles.pickerArrow} onClick={() => setPYear(y => y - 1)}>◀</button>
          <button className={styles.pickerDrillUp} onClick={() => setView('year')}>{pYear}년 ↑</button>
          <button className={styles.pickerArrow} onClick={() => setPYear(y => y + 1)}>▶</button>
        </div>
        <div className={styles.pickerGrid}>
          {MONTHS.map((m, i) => (
            <button key={i}
              className={`${styles.pickerCell} ${i + 1 === pMonth ? styles.pickerActive : ''}`}
              onClick={() => { setPMonth(i + 1); setView('week') }}>
              {m}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const years = Array.from({ length: 10 }, (_, i) => decadeStart + i)
  return (
    <div className={styles.picker}>
      <div className={styles.pickerNav}>
        <button className={styles.pickerArrow} onClick={() => setDecadeStart(s => s - 10)}>◀</button>
        <span className={styles.pickerDrillUp}>{decadeStart}–{decadeStart + 9}</span>
        <button className={styles.pickerArrow} onClick={() => setDecadeStart(s => s + 10)}>▶</button>
      </div>
      <div className={styles.pickerGrid}>
        {years.map(y => (
          <button key={y}
            className={`${styles.pickerCell} ${y === pYear ? styles.pickerActive : ''}`}
            onClick={() => { setPYear(y); setView('month') }}>
            {y}
          </button>
        ))}
      </div>
    </div>
  )
}
