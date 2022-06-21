import React, {useState} from "react";
import './style.css';

function Cash() {
  const $ = (id) => document.querySelector(id);

  // < create & save cash ------------->
  let [cash, setCash] = useState([]);
  if (localStorage.getItem('cash')) {
    cash = JSON.parse(localStorage.getItem('cash'));
  }

  const saveCash = () => localStorage.setItem('cash', JSON.stringify(cash));

  // < to client ------------->
  const showClient = () => {
    $("#cashs").style.display = "none";
    $("#clients").style.display = "block";
    $("h1").style.backgroundColor = "crimson";
  }

  // < totale cash ------------->
  const totale = (Type) => {
    let t = 0;
    Filters().map((e) => e.type === Type? t += e.cash:'');
    return t
  }

  // < add cash ------------->
  let [client, setClient] = useState([]);
  const option = client.map(({name}, i) => <option key={i}>{name}</option>);

  const showAddCash = () => {
    setClient(JSON.parse(localStorage.getItem('client')) || []);
    $("#addCash").style.display = "flex"
  };
  const cancel = () => $("#addCash").style.display = "none";

  const addCash = () => {
    const addNameClient = $("#addNameClient");
    const addCashNem = $("#addCashNem");
    const addCashType = $("#aadCashType");

    if (addCashNem.value.length) {
      const date = new Date().toString()
      cash.push({
        id: Math.random(),
        cash: +addCashNem.value > 0? +addCashNem.value: -addCashNem.value,
        name: addNameClient.value || "free",
        type: addCashType.value,
        date: date.slice(4,25),
      });
      addNameClient.value ='';
      addCashNem.value ='';
      saveCash();
      setCash(JSON.parse(localStorage.getItem('cash')));
    }
  }


  // < filter & search cash ------------->
  const showFiletr = () => $("#filter").classList.toggle("filterShow");

  const [search,setSearch] = useState("");
  const [fromDate,setFromDate] = useState("");
  const [toDate,setToDate] = useState("");
  const [filterCash,setFilterCash] = useState("all");

  const searchShow = (e) => {
    const name = e.target.value;
    setSearch(name);
  }
  const fromDateShow = (e) => {
    const name = new Date(e.target.value).getTime();
    setFromDate(name);
  }
  const toDateShow = (e) => {
    const name = new Date(e.target.value).getTime();
    setToDate(name);
  }
  const typeShow = (e) => {
    const name = e.target.value;
    setFilterCash(name);
  }

  const Filters = () => {
    let i = cash;
    i = i.filter((e) => search.length?e.name.toLowerCase().includes(search.toLowerCase()):true)
    i = i.filter((e) => fromDate?(fromDate <= new Date(e.date +"00Z").getTime()?true:false):true)
    i = i.filter((e) => toDate?(toDate >= new Date(e.date +"00Z").getTime()?true:false):true)
    i = i.filter((e) => filterCash ==="all"?true:(filterCash === e.type))
    return i
  }

  // < remove cash ------------->
  const remove = (id) => {
    const i = cash.findIndex((e) => e.id === id);
    if (i > -1) {
      cash.splice(i, 1);
      saveCash();
      setCash(cash);
      Filters();
    }
  }

  // < create card cash ------------->
  const card = Filters().map(({name, cash, type, date, id}, i) => (
    <div className="cash" key={i}>
      <span className="remove" onClick={() => remove(id)}><i class="fa-solid fa-trash-can"></i></span>
      <span><i class="fa-solid fa-sack-dollar"></i></span>
      <div className="name">
        <h3>{name}</h3>
        <p>{date}</p>
      </div>
      <span className="type" style={{ backgroundColor: type === "cach in"? "#B3E5FC":"#fcb3b3"}}>${cash}</span>
    </div>
  ));

  return (
    <div class="cashs" id="cashs">
      {/* < to client -------------> */}
      <span className="toClient" onClick={showClient}><i class="fa-solid fa-user"></i> Client</span>

      {/* < totale cash -------------> */}
      <div className="totale">
        <span>${totale("cach out")}</span>
        <span>${totale("cach in")}</span>
      </div>
      
      <div className="show">
        {/* < show add cash -------------> */}
        <button className="showAddCash" id="showAddCash" onClick={showAddCash}><i class="fa-solid fa-plus"></i></button>
        
        {/* < search cash -------------> */}
        <form>
          <input type="text" name="search" onChange={searchShow} id="search" placeholder="search"/>
          <i class="fa-solid fa-magnifying-glass"></i>
        </form>

        {/* < show filter cash -------------> */}
        <button className="showFilter" onClick={showFiletr}><i class="fa-solid fa-filter"></i></button>
      </div>

      {/* < add cash -------------> */}
      <div class="addCash" id="addCash">
        <div>
          <h2>Add cash</h2>
          <span>Name Client</span>
          {/* <input type="text" name="addNameClient" id="addNameClient"/> */}
          <select name="addNameClient" id="addNameClient">
            <option>free</option>
            {option}
          </select>
          <span>Cash</span>
          <div className="divCach">
            <input type="number" name="addCashNem" id="addCashNem"/>
            <select name="aadCashType" id="aadCashType">
              <option value="cach out">cach out</option>
              <option value="cach in">cach in</option>
            </select>
          </div>
          <div>
            <button id="send" onClick={addCash}>send</button>
            <button id="cancel" onClick={cancel} >cancel</button>
          </div>
        </div>
      </div>

      {/* < filter cash -------------> */}
      <div className="filter filterShow" id="filter">
        <h3>filter Date</h3>
        <div>
          <span>form</span>
          <input type="date" onInput={fromDateShow}/>
          <span>to</span>
          <input type="date" onInput={toDateShow}/>
        </div>
        <h3>filter cash</h3>
        <div>
          <select id="filterCash" onInput={typeShow}>
            <option value="all">all</option>
            <option value="cach out">cach out</option>
            <option value="cach in">cach in</option>
          </select>
        </div>
      </div>
        
      {/* < length cash -------------> */}
      <span>cash : {Filters().length}</span>

      {/* < show card cash -------------> */}
      <div>{card}</div>
    </div>
  );
}

export default Cash;
