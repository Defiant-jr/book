import React, { useEffect, useState } from 'react';

const formatCurrentDateTime = (date) => {
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date);
  const year = new Intl.DateTimeFormat('pt-BR', { year: 'numeric' }).format(date);
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);

  return `${day} de ${month} de ${year} - ${weekday} - ${time} h`;
};

const DateTimeDisplay = ({ className = '' }) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    let timeoutId;

    const updateAtNextMinute = () => {
      const now = new Date();
      setCurrentDate(now);

      const millisecondsUntilNextMinute =
        60_000 - (now.getSeconds() * 1_000 + now.getMilliseconds());
      timeoutId = window.setTimeout(updateAtNextMinute, millisecondsUntilNextMinute);
    };

    updateAtNextMinute();
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <time className={className} dateTime={currentDate.toISOString()}>
      {formatCurrentDateTime(currentDate)}
    </time>
  );
};

export default DateTimeDisplay;
