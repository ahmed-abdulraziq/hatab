import React, {useState} from "react";
import './style.css';

function Client() {
  const $ = (id) => document.querySelector(id);

  // < create & save client ------------->
  let [client, setClient] = useState([]);
  if (localStorage.getItem('client')) {
    client = JSON.parse(localStorage.getItem('client'));
  }

  const saveClient = () => localStorage.setItem('client', JSON.stringify(client));
  
  // < to cash ------------->
  const showCash = () => {
    $("#clients").style.display = "none";
    $("#cashs").style.display = "block";
    $("h1").style.backgroundColor = "#04afff";
  }

  // < add client ------------->
  const cancel = (name) => $(name).style.display = "none";
  const show = (name) => $(name).style.display = "block";
  const addClient = () => {
    const addName = $("#addName");
    const addPhone = $("#addPhone");
    const addAddress = $("#addAddress");

    if (addName.value.length && !client.filter((e) => e.name === addName.value).length) {
      client.push({
          id: Math.random(),
          name: addName.value,
          phone: addPhone.value,
          address: addAddress.value,
      });
      addName.value ='';
      addPhone.value ='';
      addAddress.value ='';
      saveClient();
      setClient(client);
    }
  }
  
  // < search client ------------->
  const [search,setSearch] = useState("");
  const searchShow = (e) => {
      const name = e.target.value;
      setSearch(name);
  }

  const Filters = () => {
    if (search.length !== 0) {
        return client.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    }else {
        return client
    }
  }
  
  // < card client cash ------------->
  const [cash, setCash] = useState([]);
  const [id,setId] = useState("name");
  const [showName,setShowName] = useState("name");
  const [showPhone,setShowPhone] = useState("Phone");
  const [showAddress,setShowAddress] = useState("Address");

  const showClient = (id) => {
    setCash(JSON.parse(localStorage.getItem('cash')) || []);
    const i = client.findIndex((e) => e.id === id);
    setId(client[i].id)
    setShowName(client[i].name);
    setShowPhone(client[i].phone);
    setShowAddress(client[i].address);
    show("#showClient");
  }
  
  const filterCash = () => {
    return cash.filter((e) => e.name === showName)
  }

  const cardClient = filterCash().map(({id, cash, type}, i) => (
    <div className="client" key={i}>
      <span ><i class="fa-solid fa-sack-dollar"></i></span>
      <div>
        <span className="cashClient">{cash}</span>
        <span className="type" style={{ backgroundColor: type === "cach in"? "#B3E5FC":"#fcb3b3"}}>{type}</span>
      </div>
      {/*<span className="remove" onClick={() => remove(id)}><i class="fa-solid fa-trash-can"></i></span> */}
    </div>
  ));

  
  // < card client remove ------------->
  const remove = (id) => {
    const i = client.findIndex((e) => e.id === id);
    if (i > -1) {
      client.splice(i, 1);
      localStorage.setItem('client', JSON.stringify(client))
      setClient(client);
      cancel("#showClient")
    }
  }

  // < card client cash remove ------------->
  // const remove = (id) => {
  //   const i = cash.findIndex((e) => e.id === id);
  //   if (i > -1) {
  //     cash.splice(i, 1);
  //     localStorage.setItem('cash', JSON.stringify(cash))
  //     setCash(cash);
  //     filterCash()
  //   }
  // }

  // < card ------------->
  const card = Filters().map(({name, id}, i) => (
    <div className="client" onClick={() => showClient(id)} key={i}>
      <span ><i class="fa-solid fa-user"></i></span>
      <div className="name">{name}<span></span></div>
      {/* <span className="remove" onClick={() =>remove(id)}><i class="fa-solid fa-trash-can"></i></span> */}
    </div>
  ));
  
  return (
    <div class="clients" id="clients">

      {/* < to cash -------------> */}
      <span className="toCash" onClick={showCash}><i class="fa-solid fa-user"></i> cash</span>

        <div className="show">

          {/* < show add client -------------> */}
          <button className="showAddClient" id="showAddClient" onClick={() =>show("#addClient")}><i class="fa-solid fa-plus"></i></button>
          
          {/* < search cash -------------> */}
          <form>
            <input type="text" name="search" onChange={searchShow} id="search" placeholder="search"/>
            <i class="fa-solid fa-magnifying-glass"></i>
          </form>
        </div>

        {/* < search cash -------------> */}
        <div class="addClient" id="addClient">
          <div>
            <h2>Add Client</h2>
            <span>Name</span>
            <input type="text" name="addName" id="addName"/>
            <span>Phone</span>
            <input type="text" name="addPhone" id="addPhone"/>
            <span>Address</span>
            <input type="text" name="addAddress" id="addAddress"/>
            <div>
              <button id="send" onClick={addClient}>send</button>
              <button id="cancel" onClick={() =>cancel("#addClient")} >cancel</button>
            </div>
          </div>
        </div>

        {/* < length client -------------> */}
        <span>Client : {Filters().length}</span>

        {/* < show card clients -------------> */}
        <div className="card">{card}</div>

        {/* < show card client -------------> */}
        <div className="showClient" id="showClient">
          <div>
            <span className="remove position" onClick={() =>remove(id)}><i class="fa-solid fa-trash-can"></i></span>
            <h3>{showName}</h3>
            <div className="info">
              <p><i class="fa-solid fa-phone"></i>{showPhone}</p>
              <p><i class="fa-solid fa-location-dot"></i>{showAddress}</p>
            </div>
            <span>Client : {filterCash().length || "0"}</span>
            <div>{cardClient}</div>
            <button onClick={() =>cancel("#showClient")} >cancel</button>
          </div>
        </div>

    </div>
  );
}

export default Client;
