import React, { useState } from 'react';
import { buildPath } from './Path';
import { retrieveToken, storeToken } from '../tokenStorage';
import type { AddCardResponse, SearchCardsResponse } from '@cop4331/shared';

function CardUI()
{
    const [message,setMessage] = useState('');
    const [searchResults,setResults] = useState('');
    const [cardList,setCardList] = useState('');
    const [search,setSearchValue] = React.useState('');
    const [card,setCardNameValue] = React.useState('');

    const _ud = localStorage.getItem('user_data');
    const ud = JSON.parse(String(_ud));
    const userId = ud.id;

    async function addCard(e:React.SyntheticEvent) : Promise<void>
    {
        e.preventDefault();

        const obj = {userId:userId,card:card,jwtToken:retrieveToken()};
        const js = JSON.stringify(obj);

        try
        {
            const response = await fetch(buildPath('api/addcard'),
            {method:'POST',body:js,headers:{'Content-Type': 'application/json'}});

            const res:AddCardResponse = JSON.parse(await response.text());

            if( res.error.length > 0 )
            {
                setMessage( "API Error:" + res.error );
            }
            else
            {
                setMessage('Card has been added');
                if( res.jwtToken ) storeToken( res.jwtToken );
            }
        }
        catch(error:any)
        {
            setMessage(error.toString());
        }
    };

    async function searchCard(e:React.SyntheticEvent) : Promise<void>
    {
        e.preventDefault();

        const obj = {userId:userId,search:search,jwtToken:retrieveToken()};
        const js = JSON.stringify(obj);

        try
        {
            const response = await fetch(buildPath('api/searchcards'),
            {method:'POST',body:js,headers:{'Content-Type': 'application/json'}});

            const res:SearchCardsResponse = JSON.parse(await response.text());

            if( res.error.length > 0 )
            {
                setResults( "API Error:" + res.error );
                return;
            }

            setResults('Card(s) have been retrieved');
            if( res.jwtToken ) storeToken( res.jwtToken );
            setCardList( res.results.join(', ') );
        }
        catch(error:any)
        {
            alert(error.toString());
            setResults(error.toString());
        }
    };

    function handleSearchTextChange( e: React.ChangeEvent<HTMLInputElement> ) : void
    {
        setSearchValue( e.target.value );
    }

    function handleCardTextChange( e: React.ChangeEvent<HTMLInputElement> ) : void
    {
        setCardNameValue( e.target.value );
    }

    return(
      <div id="cardUIDiv">
        <br />
        Search: <input type="text" id="searchText" placeholder="Card To Search For"
          onChange={handleSearchTextChange} />
        <button type="button" id="searchCardButton" className="buttons"
          onClick={searchCard}> Search Card</button><br />
        <span id="cardSearchResult">{searchResults}</span>
        <p id="cardList">{cardList}</p><br /><br />
        Add: <input type="text" id="cardText" placeholder="Card To Add"
          onChange={handleCardTextChange} />
        <button type="button" id="addCardButton" className="buttons"
          onClick={addCard}> Add Card </button><br />
        <span id="cardAddResult">{message}</span>
      </div>
    );
}

export default CardUI;
