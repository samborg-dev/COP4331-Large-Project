import React, { useState } from 'react';
import { buildPath } from './Path';
import { storeToken } from '../tokenStorage';
import { jwtDecode } from 'jwt-decode';
import type { LoginResponse, TokenPayload } from '@cop4331/shared';

function Login()
{
  const [message,setMessage] = useState('');
  const [loginName,setLoginName] = React.useState('');
  const [loginPassword,setPassword] = React.useState('');

  async function doLogin(event:React.SyntheticEvent) : Promise<void>
  {
    event.preventDefault();

    const obj = {login:loginName,password:loginPassword};
    const js = JSON.stringify(obj);

    try
    {
      const response = await fetch(buildPath('api/login'),
        {method:'POST',body:js,headers:{'Content-Type': 'application/json'}});

      const res:LoginResponse = JSON.parse(await response.text());

      if( res.error || !res.accessToken )
      {
        setMessage('User/Password combination incorrect');
        return;
      }

      storeToken( res );

      const decoded = jwtDecode<TokenPayload>( res.accessToken );
      const user = {firstName:decoded.firstName,lastName:decoded.lastName,id:decoded.userId};
      localStorage.setItem('user_data', JSON.stringify(user));

      setMessage('');
      window.location.href = '/cards';
    }
    catch(error:any)
    {
      alert(error.toString());
      return;
    }
  };

  function handleSetLoginName( e: React.ChangeEvent<HTMLInputElement> ) : void
  {
    setLoginName( e.target.value );
  }

  function handleSetPassword( e: React.ChangeEvent<HTMLInputElement> ) : void
  {
    setPassword( e.target.value );
  }

  return(
    <div id="loginDiv">
      <span id="inner-title">PLEASE LOG IN</span><br />
      Login: <input type="text" id="loginName" placeholder="Username"
        onChange={handleSetLoginName} /><br />
      Password: <input type="password" id="loginPassword" placeholder="Password"
        onChange={handleSetPassword} />
      <input type="submit" id="loginButton" className="buttons" value="Do It"
        onClick={doLogin} />
      <span id="loginResult">{message}</span>
    </div>
  );
};

export default Login;
